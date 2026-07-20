# Reckon — session handoff

Context for continuing this build in a fresh Claude session (any account).
Read this plus `README.md` and you have the full picture.

## What Reckon is
Australian prediction-market media brand. Tagline "what do you reckon?",
positioning "The polls and news say one thing. The markets say another."
Information product only — no bets, no links to gambling operators, helpline
footer on every page. Brand: mint `#3DFFA2` on deep forest `#071A12`, fonts
Space Grotesk (display) + Inter (body), **dark theme only**. Copy voice: plain
confident Australian, **no em dashes, no semicolons**. Logo is the bare
lowercase "reckon" wordmark (the tick swoosh was removed).

## Where it lives
- **Local**: `~/Desktop/reckon/`
- **GitHub**: https://github.com/samuelmorgan214-spec/reckon (SSH key on this Mac; `git push` just works)
- **Hosting**: Vercel (imported from the GitHub repo)
- **Domain**: bought on GoDaddy, DNS pointed at Vercel (www CNAME -> cname.vercel-dns.com, @ A record -> Vercel IP). Was awaiting propagation / green "Valid Configuration" in Vercel at handoff.

## Architecture
Static site (`index.html`, `methodology.html`) + Vercel serverless functions in
`api/`. The browser only ever calls `/api/prices` — never third-party APIs
directly. Data flow: GitHub Actions cron (`.github/workflows/ingest.yml`, every
3h) hits the ingest endpoints -> they fetch sources, de-vig + median consensus,
write Supabase -> site reads Supabase via `/api/prices`. History is logged from
day one for a future calibration/track-record page.

Sources: The Odds API (AFL/NRL/World Cup/golf, bookmaker consensus), Kalshi
(US politics + crypto, exchange prices as-is), ASX RBA tracker (scrape +
manual fallback). Betfair + Polymarket are Phase 2 (Polymarket gated on legal
review — ACMA-blocked in AU, data-as-journalism only).

50 seeded markets, 10 per tab (footy/sports/politics/economy/crypto). Footy also
auto-fills live weekend matches at runtime. Board tabs + live search + Subscribe
(scrolls to email capture). Ticker scroll speed scales with market count.

## DONE
- Full repo built, committed, pushed to GitHub (clean root-level structure).
- Deployed on Vercel.
- Custom domain DNS configured on GoDaddy.

## PENDING — the remaining launch steps (in order)
1. **Verify the domain** goes green in Vercel + loads with HTTPS.
2. **Supabase**: create a project, run `db/schema.sql` in its SQL editor
   (creates tables + seeds 50 markets). Then get URL + service_role key from
   Settings -> API.
3. **Vercel env vars** (Project -> Settings -> Environment Variables), all five:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY` (the free
   the-odds-api.com key — in the operator's records, NOT committed here),
   `CRON_SECRET`, `ADMIN_SECRET` (last two: `openssl rand -hex 32` each).
4. **GitHub repo secrets** (Settings -> Secrets -> Actions): `SITE_URL` (live
   Vercel URL) + `CRON_SECRET` (same value as Vercel) so the scheduler fires.
5. **First ingest**: `curl -H "Authorization: Bearer $CRON_SECRET" "$SITE_URL/api/cron/ingest-odds"`
   then `.../ingest-kalshi`. Board's "Demo prices" banner disappears once real
   prices land.
6. **Manual markets**: economy tab + some politics are `manual` source_type and
   stay hidden until priced via `POST /api/admin/set-price` (Bearer ADMIN_SECRET).
   Slug checklist is in `README.md`.
7. **Source terms review** (`docs/source-terms.md`): confirm Odds API + Kalshi
   display terms before public launch.

## Gotchas worth knowing
- Kalshi API price fields are dollar-strings (`last_price_dollars: "0.82"`); the
  old integer-cent fields return null.
- Crypto year-max/min Kalshi ladders resolve strike by strike -> reseed each January.
- Topical sports/politics markets (World Cup, The Open) resolve fast -> retire after.
- Never commit real API keys. Secrets live in Vercel env vars only.
- The user is a beginner with git/deploy — walk click-by-click, avoid jargon.

## Local Claude memory
This machine also has project memory at
`~/.claude/projects/-Users-mentoredstudios-Downloads/memory/` — persists across
sessions on this machine regardless of account. If continuing on a different
machine, this HANDOFF.md is the source of truth.
