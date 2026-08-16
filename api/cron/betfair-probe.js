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

import { IDENTITY, BETTING } from '../../lib/betfair.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const appKey = process.env.BETFAIR_APP_KEY;
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;
  if (!appKey || !username || !password) {
    return res.status(200).json({
      ok: false,
      error: 'BETFAIR_APP_KEY, BETFAIR_USERNAME and BETFAIR_PASSWORD must be set',
      present: {
        appKey: Boolean(appKey),
        username: Boolean(username),
        password: Boolean(password),
      },
    });
  }

  const q = String(req.query.q || 'premiership');

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
    const ld = await lr.json().catch(() => ({}));
    if (ld.status !== 'SUCCESS') {
      return res.status(200).json({
        ok: false,
        stage: 'login',
        endpoint: IDENTITY,
        httpStatus: lr.status,
        betfairStatus: ld.status || null,
        betfairError: ld.error || null,
      });
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

    const eventTypes = await call('listEventTypes/', { filter: {} });
    const markets = await call('listMarketCatalogue/', {
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
