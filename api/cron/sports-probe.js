// GET /api/cron/sports-probe
//
// TEMPORARY. Delete once the board is reseeded for the summer.
//
// Lists what The Odds API currently carries, so market curation is based on
// the live catalogue rather than a guess about what is in season. Reports each
// sport's key, title, whether it is active, and whether it has outrights,
// which is the thing that decides if a "who wins it" market is possible.
//
// Auth: Authorization: Bearer <CRON_SECRET>.
// Costs no quota: the /sports endpoint is free on The Odds API.

import { login, call } from '../../lib/betfair.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Betfair mode. Lives here rather than in its own file because Vercel Hobby
  // caps the project at 12 Serverless Functions and we are at the cap.
  //   ?betfair=1&eventTypeIds=1477   rugby league
  //   &q=world%20cup                 optional text filter
  if (req.query.betfair) {
    const auth = await login();
    if (!auth.ok) return res.status(200).json({ ok: false, stage: 'login', ...auth });
    const ids = String(req.query.eventTypeIds || '').split(',').filter(Boolean);
    const q = req.query.q;
    try {
      const markets = await call('listMarketCatalogue/', auth.sessionToken, {
        filter: {
          ...(q ? { textQuery: String(q) } : {}),
          ...(ids.length ? { eventTypeIds: ids } : {}),
        },
        marketProjection: ['EVENT', 'EVENT_TYPE', 'RUNNER_DESCRIPTION'],
        maxResults: 25,
        sort: 'MAXIMUM_TRADED',
      });
      return res.status(200).json({
        ok: true,
        markets: (markets || []).map(m => ({
          marketId: m.marketId,
          marketName: m.marketName,
          event: (m.event?.name || '').trim(),
          runners: (m.runners || []).map(r => r.runnerName),
        })),
      });
    } catch (err) {
      return res.status(200).json({ ok: false, stage: 'lookup', error: String(err.message || err) });
    }
  }
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, error: 'ODDS_API_KEY not set' });

  try {
    const r = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}&all=true`
    );
    if (!r.ok) throw new Error(`sports list HTTP ${r.status}`);
    const all = await r.json();

    const active = (all || []).filter(s => s.active);

    // Australian summer plus the things an Australian audience follows anyway.
    const RELEVANT = /aussierules|rugbyleague|rugbyunion|cricket|soccer_australia|tennis|basketball_nba|americanfootball_nfl|golf|motorsport|politics|horse/i;

    const shape = s => ({
      key: s.key,
      title: s.title,
      group: s.group,
      outrights: Boolean(s.has_outrights),
    });

    res.status(200).json({
      ok: true,
      counts: { all: (all || []).length, active: active.length },
      relevant_active: active.filter(s => RELEVANT.test(s.key)).map(shape),
      outrights_active: active.filter(s => s.has_outrights).map(shape),
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
