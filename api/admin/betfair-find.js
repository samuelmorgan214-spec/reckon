// GET /api/admin/betfair-find?q=premiership
// Finds Betfair markets and prints their marketId plus runner names, so those
// values can be pasted into a market's source_config. Read-only lookup helper.
// Auth: Authorization: Bearer <ADMIN_SECRET>.

import { login, call as bfCall } from '../../lib/betfair.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const q = String(req.query.q || 'premiership');
  const eventTypeIds = req.query.eventTypeIds
    ? String(req.query.eventTypeIds).split(',')
    : undefined;

  const auth = await login();
  if (!auth.ok) return res.status(200).json({ ok: false, stage: 'login', ...auth });
  const call = (path, body) => bfCall(path, auth.sessionToken, body);

  try {
    // Listing event types helps identify the right sport id (AFL, NRL, Politics).
    const eventTypes = await call('listEventTypes/', { filter: {} });

    const markets = await call('listMarketCatalogue/', {
      filter: { textQuery: q, ...(eventTypeIds ? { eventTypeIds } : {}) },
      marketProjection: ['EVENT', 'EVENT_TYPE', 'RUNNER_DESCRIPTION'],
      maxResults: 25,
      sort: 'MAXIMUM_TRADED',
    });

    res.status(200).json({
      query: q,
      eventTypes: (eventTypes || [])
        .map(e => ({ id: e.eventType.id, name: e.eventType.name, markets: e.marketCount }))
        .sort((a, b) => b.markets - a.markets),
      markets: (markets || []).map(m => ({
        marketId: m.marketId,
        marketName: m.marketName,
        event: m.event?.name,
        eventType: m.eventType?.name,
        runners: (m.runners || []).map(r => r.runnerName),
      })),
    });
  } catch (err) {
    res.status(200).json({ error: String(err.message || err) });
  }
}
