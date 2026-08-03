# Reckon — session handoff

Everything needed to pick this up on a new machine, in a fresh Claude session.
Read this plus `README.md` and you have the full picture.

**This file contains no secrets and is safe to store anywhere.** Where a
credential is needed, it says which console to fetch it from.

Last updated: 29 July 2026.

## What Reckon is
Australian prediction-market media brand. Tagline "what do you reckon?",
positioning "The news and pundits say one thing. The markets say another."
Information product only — no bets taken, no links to gambling operators,
helpline footer on every page.

**Editorial rule, decided this session: markets only, never polls.** Prices come
from real traded markets. Anything that is Reckon's own judgement is labelled
"Reckon estimate, no market priced" and rendered in amber so it can never be
mistaken for a traded price. Poll-derived numbers were explicitly removed.

Brand: blue `#2E6BFF` accent, near-black navy `#0A0E1A` background, Inter
throughout, light/dark toggle (defaults dark, persists in localStorage).
Copy voice: plain confident Australian, **no em dashes, no semicolons**.
Logo is the bare lowercase "reckon" wordmark.

## Where it lives
- **GitHub**: https://github.com/samuelmorgan214-spec/reckon (branch `main`)
- **Hosting**: Vercel, auto-deploys on push to `main`
- **Live**: https://reckonhq.com.au
- **Database**: Supabase, project ref `cmwtlxddrgwuhplihwkp`
- **Local path (old machine)**: `~/Desktop/reckon/`

## Getting set up on a new machine

1. Install git, then clone:
   ```
   git clone https://github.com/samuelmorgan214-spec/reckon.git
   cd reckon
   ```
   If SSH is not set up yet, use the HTTPS URL above and sign in when prompted.
2. Nothing needs installing to work on the site. It is static HTML plus Vercel
   serverless functions. To preview locally: `python3 -m http.server 8000`
   then open http://localhost:8000. The board will show demo prices locally
   because `/api/*` only runs on Vercel.
3. You do **not** need a local `.env` for normal work. All credentials live in
   Vercel. Only recreate `.env` if running ingest scripts locally.

## Architecture
Static site (`index.html`, `methodology.html`) + Vercel serverless functions in
`api/`. The browser only ever calls `/api/prices`, never third-party APIs.

Flow: cron hits an ingest endpoint -> it fetches the source, converts odds to
probabilities, removes bookmaker margin, writes to Supabase -> the site reads
Supabase via `/api/prices`. Every price is also appended to `prices_history`,
so the record is permanent and auditable.

### Ingest endpoints (all need `Authorization: Bearer <CRON_SECRET>`)
| Endpoint | Source | Status |
|---|---|---|
| `/api/cron/ingest-odds` | The Odds API, AU bookmakers | Working. AFL + NRL match markets. |
| `/api/cron/ingest-kalshi` | Kalshi exchange | Working. US politics, crypto, F1. |
| `/api/cron/ingest-rba` | ASX RBA tracker scrape | Scrape fails, needs manual entry. |
| `/api/cron/ingest-betfair` | Betfair Exchange | **Built, never run.** Needs credentials. |

### Admin endpoints (need `Authorization: Bearer <ADMIN_SECRET>`)
- `POST /api/admin/set-price` — manual price entry.
  Body: `{"slug":"...","probability":0.42,"source_label":"...","note":"..."}`
- `GET /api/admin/betfair-find?q=premiership` — looks up Betfair market ids and
  runner names, for filling in a market's `source_config`.

## The site is password protected
As of 3 August 2026 the live site sits behind an HTTP Basic auth gate, set up in
`middleware.js`. Visitors get a browser prompt; wrong or no credentials returns
401 plus `noindex`, so nothing is publicly visible or searchable pre-launch.

- Credentials are `SITE_USER` and `SITE_PASS` in Vercel env vars.
- **To open the site at launch:** delete both variables in Vercel and redeploy.
  The gate stays open whenever either is missing, by design, so a deploy cannot
  lock the site out by accident.
- `/api/cron/*` and `/api/admin/*` are exempt. They carry their own bearer-token
  auth and are called by GitHub Actions, which cannot answer a browser prompt.
  Ingests keep running normally behind the gate.
- Note: `config.matcher` is deliberately absent from the middleware. That syntax
  is Next.js-specific and silently no-ops on a plain static project, which is why
  the first attempt did nothing. Paths are filtered inside the function instead.

## Current state of the board
48 markets live: AFL 9, NRL 8, Crypto 10, Economy 10, Sports 6, Politics 5.

By source: 16 Kalshi exchange, ~21 AU bookmaker consensus, 11 Reckon estimates.

Categories are `afl`, `nrl`, `sports`, `politics`, `economy`, `crypto`.
The old combined `footy` category was split into `afl` and `nrl` this session.

## Credentials — where to get each one
Never paste these into a chat or a shared document. All five are already set in
**Vercel -> Settings -> Environment Variables**. Retrieve from source if needed:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | `https://cmwtlxddrgwuhplihwkp.supabase.co` (not secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Settings -> API Keys -> `service_role` |
| `ODDS_API_KEY` | the-odds-api.com dashboard |
| `CRON_SECRET` | Vercel only. Regenerate with `openssl rand -hex 32` if lost. |
| `ADMIN_SECRET` | Vercel only. Regenerate with `openssl rand -hex 32` if lost. |

Regenerating `CRON_SECRET` or `ADMIN_SECRET` means updating Vercel **and** the
GitHub Actions secret, then redeploying.

> **Outstanding security task:** `SUPABASE_SERVICE_ROLE_KEY` was pasted into a
> chat session on 29 July 2026 and has **not** been rotated. Rotate it in
> Supabase -> API Keys, update Vercel, redeploy. Do this before anything else.
> Also delete these from the old machine's Desktop if it is recoverable:
> `RECKON KEYS.txt`, `PASTE THIS INTO SUPABASE_SERVICE_ROLE_KEY.txt`,
> `RUN THIS IN SUPABASE.sql`, and `~/Desktop/reckon/.env`.

## Gotchas that cost time this session
- **Vercel env var changes need a redeploy.** Saving alone does nothing.
  Deployments -> ⋯ -> Redeploy.
- **`/api/prices` is CDN-cached for 5 minutes.** After an ingest or a category
  change the site can look stale. Add `?cb=<timestamp>` to bypass when testing.
- **Copy SQL from a file, not from a terminal or chat display.** Pasting a shell
  command into the Supabase SQL editor produced a confusing syntax error, and
  pasting only a comment line returned "success" while doing nothing.
- **Order matters when changing a CHECK constraint**: drop it, migrate the rows,
  then add the new one. Adding first fails against existing rows.
- **The Odds API carries no AFL/NRL outrights.** Confirmed against their full
  174-sport catalogue: `has_outrights` is false for every Australian footy feed.
  Premiership futures therefore require Betfair.
- Kalshi price fields are dollar-strings (`last_price_dollars: "0.82"`); the old
  integer-cent fields return null.
- The ingesters auto-retire markets: matches deactivate once started, Kalshi
  markets deactivate when settled.

## PENDING — next steps in order
1. **Rotate the Supabase service_role key** (see security note above).
2. **Betfair credentials.** The ingester is written and deployed but has never
   run. Needs a Betfair Australia account, then the **free Delayed App Key**
   via https://betfair-datascientists.github.io/api/apiappkey/ — not the Live
   key, which costs £499 and is only for placing bets. Then add
   `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD` to Vercel and
   redeploy. This unlocks AFL/NRL premiership futures and Australian politics.
3. **Re-seed the AFL premiership markets.** The seeded teams (Collingwood,
   Brisbane Lions, Carlton, Geelong) are stale. As of late July 2026 the actual
   futures favourites are Fremantle (~$5.50) and Sydney (~$6.50). NRL is closer
   to right, Penrith ~$2.60. Fix when Betfair lands, using its runner list.
4. **The featured carousel is hardcoded.** The five cards at the top of
   `index.html` (`const FEATURED`) are hand-written and drift from the live
   board. Should read from `/api/prices`.
5. **`methodology.html` is not linked prominently** and was never reviewed after
   its rebuild. It is committed and current.
6. **`coming-soon.html`** exists as a standalone pre-launch page, never used.
7. **Source terms review** (`docs/source-terms.md`) before any real promotion:
   confirm Odds API and Kalshi display terms. Betfair adds another to check.

## Editorial decisions worth preserving
- Markets only. No polling-derived numbers, ever.
- Every price carries its source and timestamp on the card.
- Reckon's own estimates are visually distinct (amber) and say so in words.
- Manual prices are stored with a `note` explaining the reasoning, kept in
  `prices_history` so a call can be audited later.
- Do not invent numbers. If no market prices a question, either leave it unpriced
  or label the estimate honestly.
