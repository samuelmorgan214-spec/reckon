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

import crypto from 'node:crypto';
import { login, call } from '../../lib/betfair.js';

// Shape of a stored PEM, with nothing sensitive in it: the header line, the
// line count, and a hash of the *public* half. If the cert and the key were
// stored intact and as a pair, the two publicKeySha256 values match.
function pemShape(pem, kind) {
  if (!pem) return { present: false };
  const lines = pem.split('\n');
  const shape = {
    present: true,
    firstLine: lines[0],
    lastLine: lines.filter(Boolean).pop(),
    lines: lines.length,
    chars: pem.length,
    hasLiteralBackslashN: pem.includes('\\n'),
  };
  try {
    const pub =
      kind === 'cert'
        ? new crypto.X509Certificate(pem).publicKey
        : crypto.createPublicKey(crypto.createPrivateKey(pem));
    shape.publicKeySha256 = crypto
      .createHash('sha256')
      .update(pub.export({ type: 'spki', format: 'der' }))
      .digest('hex')
      .slice(0, 16);
  } catch (err) {
    shape.parseError = String(err.message || err);
  }
  return shape;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.query.shape) {
    return res.status(200).json({
      cert: pemShape(process.env.BETFAIR_CERT, 'cert'),
      key: pemShape(process.env.BETFAIR_KEY, 'key'),
    });
  }

  const q = String(req.query.q || 'premiership');
  const auth = await login();

  if (!auth.ok) {
    return res.status(200).json({ ok: false, stage: 'login', ...auth });
  }

  try {
    const eventTypes = await call('listEventTypes/', auth.sessionToken, { filter: {} });
    const eventTypeIds = req.query.eventTypeIds
      ? String(req.query.eventTypeIds).split(',')
      : undefined;

    const markets = await call('listMarketCatalogue/', auth.sessionToken, {
      filter: {
        ...(q ? { textQuery: q } : {}),
        ...(eventTypeIds ? { eventTypeIds } : {}),
      },
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
