// TEMPORARY diagnostic: lists which sport keys The Odds API currently carries,
// so we can see whether the AFL/NRL outright keys exist. Delete once resolved.
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const key = process.env.ODDS_API_KEY;
  try {
    // all=true includes out-of-season sports, which is where futures often sit
    const r = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${key}&all=true`);
    if (!r.ok) return res.status(200).json({ error: `odds api HTTP ${r.status}` });
    const all = await r.json();
    const au = all.filter(s =>
      /aussierules|rugbyleague|afl|nrl/i.test(s.key + s.group + s.title));
    res.status(200).json({
      totalSports: all.length,
      australianFooty: au.map(s => ({ key: s.key, title: s.title, active: s.active, outrights: s.has_outrights })),
    });
  } catch (e) {
    res.status(200).json({ error: String(e.message || e) });
  }
}
