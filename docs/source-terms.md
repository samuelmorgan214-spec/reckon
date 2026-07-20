# Source terms review log

Per spec section 3.3: before each source ships, check its terms on display and
republication, and record findings here. Commercial redistribution of data
downstream needs separate per-source review before that revenue line launches.

| Source | Status | Display with attribution | Redistribution / licensing | Reviewed | Notes |
|---|---|---|---|---|---|
| The Odds API | **needs review before public launch** | TBC — check https://the-odds-api.com/terms | TBC | — | Free tier in use. Confirm display rights at our scale and any attribution wording they require. |
| ASX RBA Rate Tracker | **needs review** | TBC — published figure, quoted widely by press with attribution | TBC | — | We quote the published implied probability with the attribution string "ASX 30 Day Interbank Cash Rate Futures, implied". Confirm ASX website terms on automated retrieval. |
| Betfair Exchange (phase 2) | not started | TBC | TBC | — | Requires account + app key. Check AU wallet/endpoint terms. |
| Kalshi | **in use — needs review before public launch** | TBC — check kalshi.com terms on market-data display | TBC | — | Public market data, US regulated exchange (CFTC). Ingesting 2026 midterm control markets. Attribution string "Kalshi exchange". |
| Polymarket (phase 2, gated) | **legal review required before any public use** | — | — | — | Platform is ACMA-blocked in Australia (Aug 2025). Data-as-journalism presentation only, never link to the platform, never describe access. Internal reference only until a lawyer clears it. |

## Compliance posture (standing)

- No links to gambling operators anywhere on the product. No affiliate parameters. No wagering sign-up CTAs.
- Footer disclaimer + National Gambling Helpline 1800 858 858 on every page.
- Nothing that constitutes providing or advertising a gambling service under the Interactive Gambling Act. When in doubt, present less, attribute more.
- Accuracy claims must be provable from the prices_history / resolutions tables. No claimed track record the database cannot back.
