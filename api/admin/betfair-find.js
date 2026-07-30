// GET /api/admin/betfair-find?q=premiership
// Finds Betfair markets and prints their marketId plus runner names, so those
// values can be pasted into a market's source_config. Read-only lookup helper.
// Auth: Authorization: Bearer <ADMIN_SECRET>.

const IDENTITY = 'https://identitysso.betfair.com/api/login';
const BETTING = 'https://api.betfair.com/exchange/betting/rest/v1.0';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const appKey = process.env.BETFAIR_APP_KEY;
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;
  if (!appKey || !username || !password) {
    return res.status(200).json({ error: 'betfair credentials not set' });
  }

  const q = String(req.query.q || 'premiership');
  const eventTypeIds = req.query.eventTypeIds
    ? String(req.query.eventTypeIds).split(',')
    : undefined;

  try {
    const lr = await fetch(IDENTITY, {
      method: 'POST',
      headers: {
        'X-Application': appKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ username, password }).toString(),
    });
    const ld = await lr.json();
    if (ld.status !== 'SUCCESS') {
      return res.status(200).json({ error: `login ${ld.status}: ${ld.error || ''}` });
    }
    const token = ld.token;

    const call = async (path, body) => {
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
      if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
      return r.json();
    };

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
