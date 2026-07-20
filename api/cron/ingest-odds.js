import { serviceClient } from '../../lib/supabase.js';
import { consensus } from '../../lib/devig.js';

// GET /api/cron/ingest-odds
// Pulls The Odds API (AU region), de-vigs per book, takes the median consensus,
// writes prices_current and appends prices_history. Two jobs:
//   1. Auto-sync upcoming AFL/NRL match (h2h) markets so the board is alive and
//      history accumulates from day one.
//   2. Update curated outright markets (premiership futures) when the feed
//      carries them. Missing sport keys are skipped quietly.
// Auth: Authorization: Bearer <CRON_SECRET> (Vercel cron sends this automatically).

const MATCH_SPORTS = [
  { key: 'aussierules_afl', label: 'AFL', category: 'footy' },
  { key: 'rugbyleague_nrl', label: 'NRL', category: 'footy' },
];
const REGION = 'au';
const MAX_EVENTS_PER_SPORT = 10;

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function fetchOdds(sportKey, market, apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${encodeURIComponent(apiKey)}` +
    `&regions=${REGION}&markets=${market}&oddsFormat=decimal`;
  const r = await fetch(url);
  if (r.status === 401) throw new Error('odds api key rejected');
  if (!r.ok) return { events: null, status: r.status, remaining: null };
  return {
    events: await r.json(),
    status: r.status,
    remaining: r.headers.get('x-requests-remaining'),
  };
}

function eventConsensus(ev, marketKey) {
  const perBook = (ev.bookmakers || [])
    .map(b => {
      const m = (b.markets || []).find(x => x.key === marketKey);
      return m?.outcomes?.length ? { book: b.title, outcomes: m.outcomes } : null;
    })
    .filter(Boolean);
  if (!perBook.length) return null;
  return consensus(perBook);
}

async function writePrice(supabase, marketId, probability, sourceLabel, books, raw, now) {
  await supabase.from('prices_current').upsert({
    market_id: marketId,
    probability: probability.toFixed(4),
    source_label: sourceLabel,
    contributing_books: books,
    updated_at: now,
  });
  await supabase.from('prices_history').insert({
    market_id: marketId,
    probability: probability.toFixed(4),
    raw,
    captured_at: now,
  });
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ODDS_API_KEY not set' });

  const supabase = serviceClient();
  const log = [];
  let remaining = null;
  const now = new Date().toISOString();

  try {
    // --- Job 1: auto-sync match (h2h) markets ---
    for (const sport of MATCH_SPORTS) {
      const { events, status, remaining: rem } = await fetchOdds(sport.key, 'h2h', apiKey);
      remaining = rem || remaining;
      if (!events) { log.push(`${sport.label}: skipped (HTTP ${status})`); continue; }

      let updated = 0;
      for (const ev of events.slice(0, MAX_EVENTS_PER_SPORT)) {
        const cons = eventConsensus(ev, 'h2h');
        if (!cons) continue;
        const homeProb = cons.probs[ev.home_team];
        if (homeProb == null) continue;

        const date = ev.commence_time.slice(0, 10);
        const slug = slugify(`${sport.label}-${ev.home_team}-v-${ev.away_team}-${date}`);
        const question = `${ev.home_team} to beat ${ev.away_team}`;
        const sourceLabel = `Consensus of ${cons.books} AU bookmakers, margin-adjusted`;

        const { data: market, error } = await supabase
          .from('markets')
          .upsert({
            slug,
            question,
            category: sport.category,
            source_type: 'bookmaker-consensus',
            source_config: {
              provider: 'odds_api', sport: sport.key, market: 'h2h',
              home: ev.home_team, away: ev.away_team,
              commence_time: ev.commence_time, event_id: ev.id,
            },
            active: true,
          }, { onConflict: 'slug' })
          .select('id')
          .single();
        if (error || !market) { log.push(`${slug}: upsert failed ${error?.message}`); continue; }

        await writePrice(supabase, market.id, homeProb, sourceLabel, cons.books, {
          consensus: cons.probs, per_book: cons.perBook,
        }, now);
        updated++;
      }
      log.push(`${sport.label}: ${updated} match markets updated`);
    }

    // Deactivate match markets whose event has started (they resolve, they do not linger)
    const { data: stale } = await supabase
      .from('markets')
      .select('id, slug, source_config')
      .eq('active', true)
      .eq('source_type', 'bookmaker-consensus');
    for (const m of stale || []) {
      const ct = m.source_config?.commence_time;
      if (m.source_config?.market === 'h2h' && ct && new Date(ct) < new Date()) {
        await supabase.from('markets').update({ active: false }).eq('id', m.id);
        log.push(`${m.slug}: deactivated (started)`);
      }
    }

    // --- Job 2: curated outright markets ---
    const { data: curated } = await supabase
      .from('markets')
      .select('id, slug, source_config')
      .eq('active', true)
      .eq('source_type', 'bookmaker-consensus');
    const outrights = (curated || []).filter(m => m.source_config?.market === 'outrights');
    const bySport = {};
    for (const m of outrights) (bySport[m.source_config.sport] ??= []).push(m);

    for (const [sportKey, mkts] of Object.entries(bySport)) {
      const { events, status, remaining: rem } = await fetchOdds(sportKey, 'outrights', apiKey);
      remaining = rem || remaining;
      if (!events || !events.length) { log.push(`${sportKey}: no outrights yet (HTTP ${status})`); continue; }
      const cons = eventConsensus(events[0], 'outrights');
      if (!cons) continue;
      for (const m of mkts) {
        const p = cons.probs[m.source_config.outcome];
        if (p == null) { log.push(`${m.slug}: outcome "${m.source_config.outcome}" not found in feed`); continue; }
        await writePrice(supabase, m.id, p,
          `Consensus of ${cons.books} AU bookmakers, margin-adjusted`, cons.books,
          { consensus_outcome: m.source_config.outcome, per_book_count: cons.books }, now);
        log.push(`${m.slug}: updated to ${(p * 100).toFixed(1)}%`);
      }
    }

    res.status(200).json({ ok: true, credits_remaining: remaining, log });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err), log });
  }
}
