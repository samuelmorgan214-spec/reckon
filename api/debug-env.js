// TEMPORARY diagnostic. Reports the SHAPE of env vars, never their contents.
// Auth-gated behind CRON_SECRET. Delete once the Supabase connection is fixed.
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = process.env.SUPABASE_URL || '';

  // Decode the JWT payload so we can see which project the key is actually for.
  let keyProjectRef = null, keyRole = null;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
    keyProjectRef = payload.ref || null;
    keyRole = payload.role || null;
  } catch (e) { /* not a JWT */ }

  res.status(200).json({
    SUPABASE_URL: {
      value: url,                       // not secret, it is in every client request
      hasTrailingSlash: url.endsWith('/'),
      hasRestPath: url.includes('/rest/'),
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      length: key.length,
      expectedLength: 219,
      lengthMatches: key.length === 219,
      startsCorrectly: key.startsWith('eyJhbGciOiJIUzI1NiIsInR5'),
      endsCorrectly: key.endsWith('zghpXOojhVHg'),
      looksLikeJWT: key.split('.').length === 3,
      keyIsForProject: keyProjectRef,   // must match the ref inside SUPABASE_URL
      keyRole,                          // must be "service_role", not "anon"
    },
    othersPresent: {
      ODDS_API_KEY: !!process.env.ODDS_API_KEY,
      CRON_SECRET: !!process.env.CRON_SECRET,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET,
    },
  });
}
