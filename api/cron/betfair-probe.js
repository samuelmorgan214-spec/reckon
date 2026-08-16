// GET /api/cron/betfair-probe?q=premiership
//
// TEMPORARY. Delete once the Betfair markets are seeded.
//
// Same lookup as /api/admin/betfair-find, but gated on CRON_SECRET instead of
// ADMIN_SECRET so it can be driven from the GitHub Actions workflow, which
// already holds CRON_SECRET as a repo secret. That means the Betfair login can
// be tested without anyone typing a credential into a terminal by hand.
//
// Read-only: it lists markets and runner names, and writes nothing.

import { login, call } from '../../lib/betfair.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const q = String(req.query.q || 'premiership');
  const auth = await login();

  if (!auth.ok) {
    return res.status(200).json({ ok: false, stage: 'login', ...auth });
  }

  try {
    const eventTypes = await call('listEventTypes/', auth.sessionToken, { filter: {} });
    const markets = await call('listMarketCatalogue/', auth.sessionToken, {
      filter: { textQuery: q },
      marketProjection: ['EVENT', 'EVENT_TYPE', 'RUNNER_DESCRIPTION'],
      maxResults: 25,
      sort: 'MAXIMUM_TRADED',
    });

    res.status(200).json({
      ok: true,
      stage: 'lookup',
      query: q,
      eventTypes: (eventTypes || [])
        .map(e => ({ id: e.eventType.id, name: e.eventType.name, markets: e.marketCount }))
        .sort((a, b) => b.markets - a.markets)
        .slice(0, 12),
      markets: (markets || []).map(m => ({
        marketId: m.marketId,
        marketName: m.marketName,
        event: m.event?.name,
        eventType: m.eventType?.name,
        runners: (m.runners || []).map(r => r.runnerName),
      })),
    });
  } catch (err) {
    res.status(200).json({ ok: false, stage: 'lookup', error: String(err.message || err) });
  }
}
