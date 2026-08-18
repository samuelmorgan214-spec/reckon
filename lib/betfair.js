// Betfair Exchange API access, in one place so every caller logs in the same
// way and the hosts cannot drift apart.
//
// **Automated login needs a client certificate.** The interactive endpoint
// (identitysso.betfair.com/api/login) sits behind bot mitigation and answers a
// server-to-server request with HTTP 403 and an HTML page, never JSON. Both the
// .com and .com.au hosts do this, so a 403 here is not a wrong password and not
// a wrong jurisdiction. Betfair documents the non-interactive path as a mutual
// TLS POST to identitysso-cert.betfair.com/api/certlogin.
//
// Setup, once, on the Betfair account:
//   1. Enable non-interactive login on the My Account security page.
//   2. openssl genrsa -out client-2048.key 2048
//      openssl req -new -x509 -days 3650 -key client-2048.key -out client-2048.crt
//   3. Upload client-2048.crt to Betfair.
//   4. Put the file contents in Vercel as BETFAIR_CERT and BETFAIR_KEY,
//      newlines and BEGIN/END lines included.
//
// Note the response shape differs from the interactive endpoint: certlogin
// returns loginStatus/sessionToken, not status/token.

import https from 'node:https';

// The international host is the documented one. The AU host is tried as well
// because AU/NZ is a separate licence and does run its own identitysso, which
// is how the interactive endpoint behaved. Order matters only for speed.
export const CERT_LOGIN_HOSTS = [
  'identitysso-cert.betfair.com',
  'identitysso-cert.betfair.com.au',
];
export const CERT_LOGIN_PATH = '/api/certlogin';

// Australian jurisdiction. AU/NZ is a separate licence from the international
// exchange. If listMarketCatalogue returns nothing sensible, try the .com host.
export const BETTING = 'https://api.betfair.com.au/exchange/betting/rest/v1.0';

// Resolves to { ok, sessionToken, loginStatus, httpStatus, bodySnippet }.
// Never throws on a rejected login: the caller wants to report the reason.
export function certLogin({ appKey, username, password, cert, key, host }) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ username, password }).toString();
    const req = https.request(
      {
        host,
        port: 443,
        path: CERT_LOGIN_PATH,
        method: 'POST',
        cert,
        key,
        headers: {
          'X-Application': appKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'application/json',
        },
      },
      res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(raw); } catch { /* fall through to snippet */ }
          resolve({
            host,
            ok: parsed.loginStatus === 'SUCCESS',
            sessionToken: parsed.sessionToken || null,
            loginStatus: parsed.loginStatus || null,
            httpStatus: res.statusCode,
            bodySnippet: parsed.loginStatus ? null : raw.slice(0, 200),
          });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Reads credentials from the environment and logs in. Returns the same shape as
// certLogin, plus a `missing` list when the environment is incomplete.
export async function login() {
  const appKey = process.env.BETFAIR_APP_KEY;
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;
  const cert = process.env.BETFAIR_CERT;
  const key = process.env.BETFAIR_KEY;

  const missing = Object.entries({
    BETFAIR_APP_KEY: appKey,
    BETFAIR_USERNAME: username,
    BETFAIR_PASSWORD: password,
    BETFAIR_CERT: cert,
    BETFAIR_KEY: key,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) return { ok: false, missing };

  // Try each jurisdiction and report every attempt, so a wrong host is
  // distinguishable from an unregistered certificate in a single run.
  const attempts = [];
  for (const host of CERT_LOGIN_HOSTS) {
    try {
      const r = await certLogin({ appKey, username, password, cert, key, host });
      if (r.ok) return r;
      attempts.push(r);
    } catch (err) {
      attempts.push({ host, transportError: String(err.message || err) });
    }
  }
  return { ok: false, attempts };
}

// Authenticated Betting API call. Throws on a non-2xx, the callers all catch.
export async function call(path, sessionToken, body) {
  const r = await fetch(`${BETTING}/${path}`, {
    method: 'POST',
    headers: {
      'X-Application': process.env.BETFAIR_APP_KEY,
      'X-Authentication': sessionToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.json();
}
