import { serviceClient } from '../lib/supabase.js';

// GET /api/prices
// The only feed the site reads. Third-party APIs are never called from the browser.
export default async function handler(req, res) {
  try {
    const supabase = serviceClient();

    const [{ data: markets, error: e1 }, { data: movement, error: e2 }] = await Promise.all([
      supabase
        .from('markets')
        .select('id, slug, question, category, source_type, source_config, prices_current(probability, source_label, contributing_books, updated_at)')
        .eq('active', true),
      supabase.from('market_movement').select('market_id, current_probability, probability_then'),
    ]);
    if (e1 || e2) throw e1 || e2;

    const moveById = Object.fromEntries((movement || []).map(m => [m.market_id, m]));

    const out = (markets || [])
      .filter(m => m.prices_current)
      .map(m => {
        const pc = Array.isArray(m.prices_current) ? m.prices_current[0] : m.prices_current;
        const mv = moveById[m.id];
        const movePts = mv && mv.probability_then != null
          ? Math.round((mv.current_probability - mv.probability_then) * 100)
          : 0;
        return {
          slug: m.slug,
          question: m.question,
          category: m.category,
          source_type: m.source_type,
          probability: Number(pc.probability),
          move: movePts,
          source_label: pc.source_label,
          contributing_books: pc.contributing_books,
          updated_at: pc.updated_at,
          meta: {
            commence_time: m.source_config?.commence_time || null,
          },
        };
      })
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ markets: out, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'prices unavailable', detail: String(err.message || err) });
  }
}
