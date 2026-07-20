import { serviceClient } from '../../lib/supabase.js';

// GET /api/cron/ingest-kalshi
// US politics and economics context markets from Kalshi (regulated US exchange,
// public market data, no auth needed for reads). Exchange prices carry no
// bookmaker margin so there is no de-vig: probability is the last traded price,
// falling back to the bid/ask midpoint when the market has not traded recently.
// Markets are matched by source_config: {"provider":"kalshi","ticker":"CONTROLH-2026-D"}.
// Auth: Authorization: Bearer <CRON_SECRET>.

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const ATTRIBUTION = 'Kalshi exchange';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const supabase = serviceClient();
  const log = [];
  const now = new Date().toISOString();

  try {
    const { data: rows, error } = await supabase
      .from('markets')
      .select('id, slug, source_config')
      .eq('active', true)
      .eq('source_type', 'exchange');
    if (error) throw error;
    const targets = (rows || []).filter(m => m.source_config?.provider === 'kalshi');
    if (!targets.length) {
      return res.status(200).json({ ok: true, log: ['no active kalshi markets configured'] });
    }

    for (const m of targets) {
      const ticker = m.source_config.ticker;
      const r = await fetch(`${BASE}/markets/${encodeURIComponent(ticker)}`);
      if (!r.ok) { log.push(`${m.slug}: kalshi HTTP ${r.status}`); continue; }
      const mk = (await r.json()).market;
      if (!mk) { log.push(`${m.slug}: no market in response`); continue; }

      // Market resolved or closed on the exchange: retire it from the board.
      // Outcome recording into the resolutions table stays a manual editorial step.
      if (['finalized', 'settled', 'closed'].includes(mk.status)) {
        await supabase.from('markets').update({ active: false }).eq('id', m.id);
        log.push(`${m.slug}: deactivated (kalshi status ${mk.status})`);
        continue;
      }

      const last = parseFloat(mk.last_price_dollars);
      const bid = parseFloat(mk.yes_bid_dollars);
      const ask = parseFloat(mk.yes_ask_dollars);
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : NaN;
      const p = Number.isFinite(last) && last > 0 && last < 1 ? last : mid;
      if (!(p > 0 && p < 1)) { log.push(`${m.slug}: no usable price`); continue; }

      const { error: e1 } = await supabase.from('prices_current').upsert({
        market_id: m.id,
        probability: p.toFixed(4),
        source_label: ATTRIBUTION,
        contributing_books: null,
        updated_at: now,
      });
      if (e1) { log.push(`${m.slug}: write failed ${e1.message}`); continue; }
      await supabase.from('prices_history').insert({
        market_id: m.id,
        probability: p.toFixed(4),
        raw: {
          ticker,
          last_price: Number.isFinite(last) ? last : null,
          yes_bid: Number.isFinite(bid) ? bid : null,
          yes_ask: Number.isFinite(ask) ? ask : null,
          open_interest: mk.open_interest_fp || null,
        },
        captured_at: now,
      });
      log.push(`${m.slug}: ${(p * 100).toFixed(1)}%`);
    }

    res.status(200).json({ ok: true, log });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err), log });
  }
}
