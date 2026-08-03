import { serviceClient } from '../lib/supabase.js';

// GET /api/history?slugs=a,b,c
// Real price history for the featured cards, straight out of prices_history.
//
// The carousel used to draw its charts from a seeded random walk, which meant
// the lines on the front page were invented. This serves the actual record
// instead, so a chart either shows what happened or shows nothing.
//
// Takes several slugs at once because the carousel needs all its cards up
// front and five round trips would be five cold starts.

const WINDOW_DAYS = 90;
const MAX_SLUGS = 10;
const POINTS = 26; // matches the chart's x-resolution

// prices_history is written on every ingest, so a busy market can hold
// thousands of rows over the window. Downsample to evenly spaced buckets and
// take the last observation in each, which keeps the shape and the true
// endpoint without shipping the whole table to the browser.
function downsample(rows, n) {
  if (rows.length <= n) return rows;
  const first = new Date(rows[0].captured_at).getTime();
  const last = new Date(rows[rows.length - 1].captured_at).getTime();
  const span = last - first;
  if (span <= 0) return [rows[rows.length - 1]];

  const buckets = new Array(n).fill(null);
  for (const r of rows) {
    const t = (new Date(r.captured_at).getTime() - first) / span;
    const i = Math.min(n - 1, Math.floor(t * n));
    buckets[i] = r; // last write wins, so each bucket holds its latest reading
  }
  return buckets.filter(Boolean);
}

export default async function handler(req, res) {
  try {
    const raw = String(req.query.slugs || req.query.slug || '');
    const slugs = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_SLUGS);
    if (!slugs.length) {
      return res.status(400).json({ error: 'pass ?slugs=slug-a,slug-b' });
    }

    const supabase = serviceClient();

    const { data: markets, error: e1 } = await supabase
      .from('markets')
      .select('id, slug')
      .in('slug', slugs);
    if (e1) throw e1;

    const idBySlug = Object.fromEntries((markets || []).map(m => [m.slug, m.id]));
    const ids = Object.values(idBySlug);
    if (!ids.length) return res.status(200).json({ history: {} });

    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
    const { data: rows, error: e2 } = await supabase
      .from('prices_history')
      .select('market_id, probability, captured_at')
      .in('market_id', ids)
      .gte('captured_at', since)
      .order('captured_at', { ascending: true });
    if (e2) throw e2;

    const byId = {};
    for (const r of rows || []) (byId[r.market_id] ??= []).push(r);

    const history = {};
    for (const [slug, id] of Object.entries(idBySlug)) {
      history[slug] = downsample(byId[id] || [], POINTS).map(r => ({
        t: r.captured_at,
        p: Math.round(Number(r.probability) * 100),
      }));
    }

    // Same cache window as /api/prices, so the chart and the number under it
    // can never disagree about which ingest they came from.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ history, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'history unavailable', detail: String(err.message || err) });
  }
}
