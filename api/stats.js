import { serviceClient } from '../lib/supabase.js';

// GET /api/stats
// Everything the dashboard needs, in one call.
//
// No bearer token of its own on purpose. This endpoint is not in the
// middleware allowlist, so the site password gate already stands in front of
// it, the same as the board. That keeps it out of /api/admin/*, which is
// exempt from the gate precisely because GitHub Actions cannot answer a
// browser prompt. A dashboard in a browser can.

function sinceISO(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export default async function handler(req, res) {
  try {
    const supabase = serviceClient();

    const [total, day, week, recent, markets, prices] = await Promise.all([
      supabase.from('subscribers').select('*', { count: 'exact', head: true }),
      supabase.from('subscribers').select('*', { count: 'exact', head: true })
        .gte('created_at', sinceISO(24)),
      supabase.from('subscribers').select('*', { count: 'exact', head: true })
        .gte('created_at', sinceISO(24 * 7)),
      supabase.from('subscribers').select('email, created_at')
        .order('created_at', { ascending: false }).limit(25),
      supabase.from('markets').select('id, category, active, source_config'),
      supabase.from('prices_current').select('market_id, updated_at, source_label'),
    ]);

    const rows = markets.data || [];
    const active = rows.filter(m => m.active);

    const byCategory = {};
    for (const m of active) byCategory[m.category] = (byCategory[m.category] || 0) + 1;

    const byProvider = {};
    for (const m of active) {
      const p = m.source_config?.provider || 'unknown';
      byProvider[p] = (byProvider[p] || 0) + 1;
    }

    // Staleness is the thing that has actually bitten this project, twice, so
    // the dashboard leads with it: the oldest price on an active market is the
    // honest measure of whether ingest is alive.
    const activeIds = new Set(active.map(m => m.id));
    const stamps = (prices.data || [])
      .filter(p => activeIds.has(p.market_id))
      .map(p => p.updated_at)
      .filter(Boolean)
      .sort();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      subscribers: {
        total: total.count || 0,
        last_24h: day.count || 0,
        last_7d: week.count || 0,
        recent: recent.data || [],
      },
      board: {
        active: active.length,
        inactive: rows.length - active.length,
        by_category: byCategory,
        by_provider: byProvider,
        oldest_price: stamps[0] || null,
        newest_price: stamps[stamps.length - 1] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
