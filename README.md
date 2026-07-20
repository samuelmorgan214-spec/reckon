# Reckon

Australian media brand covering what betting and prediction markets imply about
the questions Australians argue about. Information product. Does not accept bets.

Full founding brief: see the technical spec (data sources, methodology,
compliance guardrails). This README covers running the thing.

## Layout

```
index.html                  Live site. Reads /api/prices only. Demo fallback if the API is down.
methodology.html            Public plain-English methodology page.
reckon.html                 v1 dev page (AI odds search + client-side bookie board). Not deployed as the main site.
reckon-card-maker.html      1080x1080 social card generator.
api/prices.js               GET  — the site's only data feed
api/subscribe.js            POST — email capture into the subscribers table
api/admin/set-price.js      POST — manual price entry (ADMIN_SECRET)
api/cron/ingest-odds.js     GET  — Odds API ingest: de-vig, median consensus, history (CRON_SECRET)
api/cron/ingest-rba.js      GET  — ASX RBA tracker best-effort scrape (CRON_SECRET)
api/cron/ingest-kalshi.js   GET  — Kalshi exchange prices for US politics cards (CRON_SECRET)
lib/devig.js                Pluggable de-vig + median consensus
db/schema.sql               Postgres schema + seed markets (run in Supabase)
.github/workflows/ingest.yml  Primary scheduler (Vercel free crons are daily only)
docs/source-terms.md        Source ToS review log
```

## One-time setup

1. **Supabase**: create a project at supabase.com. In the SQL editor, run `db/schema.sql`.
   Grab the project URL and the service_role key from Settings -> API.
2. **Secrets**: generate two random strings (`openssl rand -hex 32`) for CRON_SECRET and ADMIN_SECRET.
3. **Vercel**: import this repo at vercel.com. Add env vars from `.env.example`
   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ODDS_API_KEY, CRON_SECRET, ADMIN_SECRET). Deploy.
4. **GitHub repo secrets** (for the scheduler): `SITE_URL` (the deployed URL) and `CRON_SECRET`.
5. Kick the first ingest manually:
   ```sh
   curl -H "Authorization: Bearer $CRON_SECRET" "$SITE_URL/api/cron/ingest-odds"
   ```
6. Set the RBA figure (manual path, until/unless the scrape holds up):
   ```sh
   curl -X POST "$SITE_URL/api/admin/set-price" \
     -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
     -d '{"slug":"rba-cut-next-meeting","probability":0.68}'
   ```
7. Post day-one figures for the manual conversation markets (they stay hidden until priced).
   These carry the "Editorial estimate, manual entry" label and upgrade to Betfair exchange
   prices in phase 2. Slugs:
   - `federal-election-labor`
   - `gambling-ad-ban-jan-2027`
   - `one-nation-house-seat`
   - `one-nation-primary-10pc`
   - `opposition-leadership-change-2026`
   - `albanese-pm-at-christmas`
   - `early-federal-election-2026`
   - `nsw-origin-game-three`
   - `richmond-wooden-spoon-2026`
   - `inflation-under-3pc-christmas`
   - `brisbane-over-melbourne-prices`
   - `unemployment-above-45-next-print`
   - `sydney-house-prices-up-yoy`
   - `cash-rate-below-3-eoy`
   - `asx200-above-9000-eoy`
   - `wages-beat-inflation-2026`
   - `aud-above-70c-eoy`

## Quota budget (Odds API free tier: 500/month)

Ingest runs every 3 hours via GitHub Actions (~2-4 credits per run, ~480-640/month).
If usage creeps over, widen the cron in `.github/workflows/ingest.yml` or upgrade
the Odds API tier. `x-requests-remaining` is logged by every ingest response.

## Phase 1 definition of done

1. Site shows real AFL/NRL and RBA probabilities with source labels and update times, refreshed automatically.
2. prices_history accumulating on schedule.
3. Methodology page live.
4. Email capture works end to end.
5. Zero third-party API keys exposed client-side.
