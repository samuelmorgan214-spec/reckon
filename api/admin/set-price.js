import { serviceClient } from '../../lib/supabase.js';

// POST /api/admin/set-price
// Manual price entry. This is the dependable fallback for sources without a
// clean API (the ASX rate tracker figure, politics markets pre-Betfair).
// Body: { slug, probability (0-1), source_label?, note? }
// Auth: Authorization: Bearer <ADMIN_SECRET>
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { slug, probability, source_label, note } = req.body || {};
  const p = Number(probability);
  if (!slug || !(p > 0 && p < 1)) {
    return res.status(400).json({ error: 'need slug and probability between 0 and 1' });
  }
  try {
    const supabase = serviceClient();
    const { data: market, error: e1 } = await supabase
      .from('markets').select('id, source_type').eq('slug', slug).single();
    if (e1 || !market) return res.status(404).json({ error: 'unknown market slug' });

    const label = source_label || (market.source_type === 'futures-implied'
      ? 'ASX 30 Day Interbank Cash Rate Futures, implied (manual entry)'
      : 'Editorial estimate, manual entry');
    const now = new Date().toISOString();

    const { error: e2 } = await supabase.from('prices_current').upsert({
      market_id: market.id, probability: p, source_label: label,
      contributing_books: null, updated_at: now,
    });
    if (e2) throw e2;
    const { error: e3 } = await supabase.from('prices_history').insert({
      market_id: market.id, probability: p,
      raw: { manual: true, note: note || null }, captured_at: now,
    });
    if (e3) throw e3;
    res.status(200).json({ ok: true, slug, probability: p, source_label: label });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
