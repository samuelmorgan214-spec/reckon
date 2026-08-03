// Pre-launch password gate.
//
// Asks for a username and password before serving anything, using HTTP Basic
// auth so the browser handles the prompt. A 401 also keeps search engines out,
// so nothing gets indexed before launch.
//
// Set SITE_USER and SITE_PASS in Vercel to switch it on. If either is missing
// the gate stays open, so a deploy can never lock you out by accident.
//
// No config.matcher here on purpose: that is Next.js path-to-regexp syntax and
// this is a plain static project, so paths are filtered inside the function.

export const config = { runtime: 'edge' };

export default function middleware(request) {
  const user = process.env.SITE_USER;
  const pass = process.env.SITE_PASS;

  // Not configured yet: stay open rather than risk locking the site out.
  if (!user || !pass) return;

  const path = new URL(request.url).pathname;

  // Vercel internals.
  if (path.startsWith('/_vercel')) return;

  // Machine-to-machine endpoints carry their own bearer-token auth and are
  // called by GitHub Actions, which cannot answer a browser prompt.
  if (path.startsWith('/api/cron/') || path.startsWith('/api/admin/')) return;

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      decoded = '';
    }
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      if (decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
        return; // credentials good, let it through
      }
    }
  }

  return new Response('Reckon is not open to the public yet.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Reckon", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
