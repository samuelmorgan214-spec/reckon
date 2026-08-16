import { serviceClient } from '../../lib/supabase.js';
import { devig } from '../../lib/devig.js';
import { IDENTITY, BETTING } from '../../lib/betfair.js';

// GET /api/cron/ingest-betfair
// Outright (futures) markets from the Betfair Exchange: AFL and NRL premiership
// winners, and Australian politics questions no bookmaker prices cleanly.
//
// Betfair is a peer-to-peer exchange, so there is no bookmaker margin in the
// usual sense. There is still a small overround across runners because the best
// back prices sit inside the spread, so we renormalise across the runner set to
// make the probabilities sum to 1. That is the same proportional method used for
// bookmaker consensus, applied to a single price source rather than many.
//
// Markets are matched by source_config:
//   {"provider":"betfair","marketId":"1.2345678","runner":"Penrith Panthers"}
// or, when the marketId is not known ahead of time, by lookup:
//   {"provider":"betfair","eventTypeId":"61420","marketName":"Premiership Winner","runner":"Penrith Panthers"}
//
// Auth: Authorization: Bearer <CRON_SECRET>.
// Credentials: BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD.
// The free Delayed App Key is sufficient here: prices lag by 1-180s, which is
// immaterial for a media board and avoids the Live key activation fee.

const ATTRIBUTION = 'Betfair Exchange, delayed';

async function login(appKey, username, password) {
  const r = await fetch(IDENTITY, {
    method: 'POST',
    headers: {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ username, password }).toString(),
  });
  if (!r.ok) throw new Error(`betfair login HTTP ${r.status}`);
  const d = await r.json();
  if (d.status !== 'SUCCESS') throw new Error(`betfair login ${d.status}: ${d.error || ''}`);
  return d.token;
}

async function rpc(path, token, appKey, body) {
  const r = await fetch(`${BETTING}/${path}`, {
    method: 'POST',
    headers: {
      'X-Application': appKey,
      'X-Authentication': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`betfair ${path} HTTP ${r.status}`);
  return r.json();
}

// Best available back price for each runner, as an implied probability.
// Falls back to last traded price when the book is empty on the back side.
function runnerProb(runner) {
  const back = runner.ex?.availableToBack?.[0]?.price;
  const last = runner.lastPriceTraded;
  const price = back || last;
  if (!price || price <= 1) return null;
  return 1 / price;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const appKey = process.env.BETFAIR_APP_KEY;
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;
  if (!appKey || !username || !password) {
    return res.status(200).json({
      ok: false,
      error: 'BETFAIR_APP_KEY, BETFAIR_USERNAME and BETFAIR_PASSWORD must be set',
    });
  }

  const supabase = serviceClient();
  const log = [];
  const now = new Date().toISOString();

  try {
    const { data: rows, error } = await supabase
      .from('markets')
      .select('id, slug, source_config')
      .eq('active', true);
    if (error) throw error;
    const targets = (rows || []).filter(m => m.source_config?.provider === 'betfair');
    if (!targets.length) {
      return res.status(200).json({ ok: true, log: ['no active betfair markets configured'] });
    }

    const token = await login(appKey, username, password);

    // Group our markets by the Betfair marketId they read from, so each
    // exchange market is fetched once and normalised across its full runner set.
    const byMarketId = {};
    for (const m of targets) {
      const id = m.source_config.marketId;
      if (!id) { log.push(`${m.slug}: no marketId in source_config`); continue; }
      (byMarketId[id] ??= []).push(m);
    }

    for (const [marketId, ours] of Object.entries(byMarketId)) {
      let book;
      try {
        const [b] = await rpc('listMarketBook/', token, appKey, {
          marketIds: [marketId],
          priceProjection: { priceData: ['EX_BEST_OFFERS'] },
        });
        book = b;
      } catch (e) {
        log.push(`marketId ${marketId}: ${e.message}`);
        continue;
      }
      if (!book) { log.push(`marketId ${marketId}: no book returned`); continue; }
      if (book.status !== 'OPEN') {
        for (const m of ours) {
          await supabase.from('markets').update({ active: false }).eq('id', m.id);
          log.push(`${m.slug}: deactivated (betfair status ${book.status})`);
        }
        continue;
      }

      // Name the runners so we can match ours against them.
      const [cat] = await rpc('listMarketCatalogue/', token, appKey, {
        filter: { marketIds: [marketId] },
        marketProjection: ['RUNNER_DESCRIPTION'],
        maxResults: 1,
      });
      const nameById = {};
      for (const r of cat?.runners || []) nameById[r.selectionId] = r.runnerName;

      // Renormalise across every active runner so probabilities sum to 1.
      const active = (book.runners || []).filter(r => r.status === 'ACTIVE');
      const raw = active.map(runnerProb);
      if (raw.some(p => p === null)) {
        log.push(`marketId ${marketId}: incomplete price data, skipped`);
        continue;
      }
      const trued = devig('proportional', raw);
      const probByName = {};
      active.forEach((r, i) => { probByName[nameById[r.selectionId]] = trued[i]; });

      for (const m of ours) {
        const want = m.source_config.runner;
        const p = probByName[want];
        if (p === undefined) {
          log.push(`${m.slug}: runner "${want}" not in market ${marketId}`);
          continue;
        }
        const { error: e1 } = await supabase.from('prices_current').upsert({
          market_id: m.id,
          probability: p,
          source_label: ATTRIBUTION,
          contributing_books: null,
          updated_at: now,
        });
        if (e1) { log.push(`${m.slug}: upsert failed ${e1.message}`); continue; }
        await supabase.from('prices_history').insert({
          market_id: m.id,
          probability: p,
          raw: { provider: 'betfair', marketId, runner: want, runners: probByName },
          captured_at: now,
        });
        log.push(`${m.slug}: ${(p * 100).toFixed(1)}%`);
      }
    }

    res.status(200).json({ ok: true, log });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err.message || err), log });
  }
}
