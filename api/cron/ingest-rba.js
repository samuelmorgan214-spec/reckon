import { serviceClient } from '../../lib/supabase.js';

// GET /api/cron/ingest-rba
// Best-effort scrape of the ASX RBA Rate Tracker implied probability.
// The ASX page is JavaScript-rendered, so this scrape is expected to be
// fragile. When it cannot find a confident figure it exits without writing
// and the market keeps its last value. The dependable path is manual entry
// via POST /api/admin/set-price on RBA-relevant days (spec section 3.1c).
// Auth: Authorization: Bearer <CRON_SECRET>.

const TRACKER_URL = 'https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker';
const MARKET_SLUG = 'rba-cut-next-meeting';
const ATTRIBUTION = 'ASX 30 Day Interbank Cash Rate Futures, implied';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const r = await fetch(TRACKER_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (reckon.au data ingest; contact: sam@mentored.com.au)' } });
    if (!r.ok) {
      return res.status(200).json({ ok: false, note: `ASX page returned ${r.status}. Use manual entry.` });
    }
    const html = await r.text();

    // Look for a percentage figure adjacent to cut/decrease language.
    // Adjust this pattern against the live page markup when it changes.
    const m = html.match(/(?:cut|decrease|easing)[^%]{0,200}?(\d{1,3}(?:\.\d+)?)\s?%/i)
           || html.match(/(\d{1,3}(?:\.\d+)?)\s?%[^.]{0,120}?(?:cut|decrease)/i);
    if (!m) {
      return res.status(200).json({ ok: false, note: 'No confident figure found on ASX page. Use manual entry via /api/admin/set-price.' });
    }
    const pct = parseFloat(m[1]);
    if (!(pct > 0 && pct < 100)) {
      return res.status(200).json({ ok: false, note: `Parsed implausible figure ${pct}. Use manual entry.` });
    }

    const supabase = serviceClient();
    const { data: market } = await supabase.from('markets').select('id').eq('slug', MARKET_SLUG).single();
    if (!market) return res.status(500).json({ ok: false, error: 'RBA market row missing. Run db/schema.sql seeds.' });

    const now = new Date().toISOString();
    const p = pct / 100;
    await supabase.from('prices_current').upsert({
      market_id: market.id, probability: p.toFixed(4),
      source_label: ATTRIBUTION, contributing_books: null, updated_at: now,
    });
    await supabase.from('prices_history').insert({
      market_id: market.id, probability: p.toFixed(4),
      raw: { scraped: true, matched_text: m[0].slice(0, 200) }, captured_at: now,
    });
    res.status(200).json({ ok: true, probability: p, source: ATTRIBUTION });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
