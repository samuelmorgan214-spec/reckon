# Reckon — session handoff

Everything needed to pick this up on a new machine, in a fresh Claude session.
Read this plus `README.md` and you have the full picture.

**This file contains no secrets and is safe to store anywhere.** Where a
credential is needed, it says which console to fetch it from.

Last updated: 4 August 2026.

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
- **Local path**: `~/Desktop/reckon/` on the machine of the day. Keep the
  project in its own folder. Do not let a git repo end up rooted at your home
  directory, which happened once and made every tool report the wrong project.

## Getting set up on a new machine

> **Read this before cloning.** As of 4 August 2026 the two newest commits
> (`b15eb48`, `67f6e43`, the live carousel work) exist **only on the Mac they
> were written on**. Push was never authenticated. A plain clone from GitHub
> gets you the code *without* them. See "Moving the unpushed work" below.

1. Install git, then clone:
   ```
   git clone https://github.com/samuelmorgan214-spec/reckon.git
   cd reckon
   ```
2. Set your identity, or commits will fail:
   ```
   git config user.name "Sam"
   git config user.email "samuelmorgan214@gmail.com"
   ```
3. Nothing needs installing to work on the site. It is static HTML plus Vercel
   serverless functions. To preview locally: `python3 -m http.server 8000`
   then open http://localhost:8000. The board will show demo prices locally
   because `/api/*` only runs on Vercel.
4. You do **not** need a local `.env` for normal work. All credentials live in
   Vercel. Only recreate `.env` if running ingest scripts locally.

### Getting push to work (do this once, it is the fiddly bit)

GitHub has not accepted passwords since 2021, so a push needs a key or a
token. SSH keys do not transfer between machines by design, so the new one
needs its own. On the new machine:

```
ssh-keygen -t ed25519 -C "samuelmorgan214@gmail.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Paste that whole line into https://github.com/settings/ssh/new as an
**Authentication Key** (not a Signing Key, they are different and the wrong one
looks like it worked). GitHub may ask for your password or 2FA to confirm, and
if you skip that step the key silently does not save. Then:

```
git remote set-url origin git@github.com:samuelmorgan214-spec/reckon.git
ssh -T git@github.com          # expect "Hi <user>! You've successfully authenticated"
git push origin main
```

If it says `Permission denied (publickey)`, the key is not on the account.
Check https://github.com/settings/keys and compare the fingerprint against
`ssh-keygen -lf ~/.ssh/id_ed25519.pub`.

Do **not** use the `https://<user>:<token>@github.com/...` remote form. It
writes the token in clear text into `.git/config`.

### Moving the unpushed work

Best case, push from the old machine first, then clone normally and skip this.

Otherwise there is a bundle at `~/Desktop/reckon-work.bundle` on the old
machine, 106K, containing the complete history. AirDrop it across, then:

```
git clone ~/Desktop/reckon-work.bundle reckon
cd reckon
git remote set-url origin git@github.com:samuelmorgan214-spec/reckon.git
```

That gives you every commit including the two unpushed ones, with origin
pointed back at GitHub.

**Do not AirDrop the project folder itself.** That is what spread the
credentials in the first place: the folder went across with `.env` intact and
the service-role key landed on a second machine in clear text.

## Architecture
Static site (`index.html`, `methodology.html`) + Vercel serverless functions in
`api/`. The browser only ever calls `/api/prices` and `/api/history`, never
third-party APIs.

No Supabase key is used in the browser anywhere. Only the server-side
service-role key in `lib/supabase.js`, which is why rotating it needs a Vercel
change and nothing else.

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

### Read endpoints (public, behind the site password gate)
| Endpoint | What it serves |
|---|---|
| `/api/prices` | The board. Every active market with its current price. |
| `/api/history` | `?slugs=a,b,c`. Real snapshots from `prices_history` over the last 90 days, downsampled to 26 points, for the carousel charts. Added 4 Aug 2026. |

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

> **Outstanding security tasks. Nothing below has been done yet.**
>
> **1. Four secrets are exposed, not one.** The original note only tracked the
> Supabase key, but the AirDropped `.env` carried all of them. As of 4 August
> 2026 a live copy sits at `~/Downloads/reckon/.env` on the old machine holding
> `SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY`, `CRON_SECRET` and `ADMIN_SECRET`.
> Treat all four as burned. `ADMIN_SECRET` is the one that lets anyone write
> arbitrary prices to the board through `/api/admin/set-price`.
>
> Rotate in this order, verifying the board after each:
> - `SUPABASE_SERVICE_ROLE_KEY` in Supabase -> API Keys. If the project offers
>   new-style `sb_secret_...` keys, create the new one first, put it in Vercel,
>   redeploy, verify, and only then revoke the old one, which is zero downtime.
>   If it only offers legacy `anon`/`service_role`, resetting the JWT secret
>   kills both at once and the board 500s until the redeploy lands. Nothing in
>   the browser uses the anon key, so losing it breaks nothing.
> - `ODDS_API_KEY` regenerates at the-odds-api.com.
> - `CRON_SECRET` and `ADMIN_SECRET` are yours to invent, `openssl rand -hex 32`.
>   `CRON_SECRET` lives in **two** places, Vercel and the GitHub Actions secret.
>   Update both or the ingests stop.
>
> **2. A GitHub personal access token was pasted into a chat on 3 August 2026**
> and has not been revoked. Delete it at
> https://github.com/settings/personal-access-tokens. It is not used by
> anything, so deleting it breaks nothing.
>
> **3. The old machine's SSH key** (`sams max`, added 20 July 2026) still has
> read/write on the account. Once the new machine is working, remove it at
> https://github.com/settings/keys if the old Mac is being retired.
>
> The loose files from the earlier note (`RECKON KEYS.txt`,
> `PASTE THIS INTO SUPABASE_SERVICE_ROLE_KEY.txt`, `RUN THIS IN SUPABASE.sql`)
> were checked on 3 August and no longer exist. Find any that reappear with:
> `find ~ -name ".env" -path "*reckon*" 2>/dev/null; ls ~/Desktop ~/Downloads | grep -iE "RECKON KEYS|PASTE THIS|RUN THIS"`
>
> Rotating the keys makes every one of those copies useless, which is the real
> fix. Delete them anyway.

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
- **Never let a git repo sit at your home directory.** One did, wired to an
  unrelated project, and every tool then reported the wrong repo from any
  folder, because git searches upward until it finds a `.git`. It also counted
  every file on the machine as a pending change. Keep each project in its own
  folder with its own repo.
- **SSH keys do not move between machines.** The private half stays put by
  design. Each machine generates its own and adds its own public key to GitHub.
- `fmtUpdated()` already includes the word "updated" and returns an empty
  string for the demo feed, which has no timestamps. Concatenating it after
  your own "Updated " gives "Updated updated 2:20pm".
- The demo fallback is `[category, question, pct, move]` tuples mapped into
  objects with no `slug` and no `contributing_books`. Anything reading the
  board has to survive those being missing.

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
4. ~~**The featured carousel is hardcoded.**~~ Done 4 August 2026, see
   "The featured carousel" below. Returns as an enhancement once Betfair lands.
5. **`methodology.html` is not linked prominently** and was never reviewed after
   its rebuild. It is committed and current.
6. **`coming-soon.html`** exists as a standalone pre-launch page, never used.
7. **Source terms review** (`docs/source-terms.md`) before any real promotion:
   confirm Odds API and Kalshi display terms. Betfair adds another to check.

## The featured carousel
Rewritten 4 August 2026 (`b15eb48`, `67f6e43`). Worth knowing why it looks the
way it does before changing it back.

It used to be a hand written `const FEATURED` array of five cards sitting above
48 live markets, so it drifted. Two things were worse than drift: one card was
a "Next Prime Minister" chart built from polling, against the markets-only
rule, and **every chart on it was fabricated**. `seededSeries(name, end, bias, n)`
generated a plausible looking 26-point trend from a string seed. Those lines
were never measured. All of it is deleted.

**What it does now.** Five cards, the five biggest movers off `/api/prices`,
ranked by absolute 7-day move. Charts come from `/api/history`, and a market
with fewer than two snapshots renders "not enough history yet" rather than a
line. The old "why it moved" prose is replaced by movement, source and
timestamp, so there is nothing left to hand-maintain.

**Why cards show Yes against No rather than a runner table.** A row in
`markets` is one binary question with one probability. There is no grouping
column. The only grouped markets in the design are Betfair outrights, bundled
by a shared `source_config.marketId` in `api/cron/ingest-betfair.js`, and
Betfair has never ingested. So a runner table ("premiership, four teams, four
prices") cannot be built from live data yet. When Betfair lands, expose a group
key through `/api/prices` and the multi-runner layout can come back.

**Expect sparse charts at first.** `prices_history` needs a few days of
snapshots per market before the lines have anything to draw.

## Editorial decisions worth preserving
- Markets only. No polling-derived numbers, ever.
- Every price carries its source and timestamp on the card.
- Reckon's own estimates are visually distinct (amber) and say so in words.
- Manual prices are stored with a `note` explaining the reasoning, kept in
  `prices_history` so a call can be audited later.
- Do not invent numbers. If no market prices a question, either leave it unpriced
  or label the estimate honestly.
