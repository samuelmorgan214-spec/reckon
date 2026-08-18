# Source terms review log

Per spec section 3.3: before each source ships, check its terms on display and
republication, and record findings here. Commercial redistribution of data
downstream needs separate per-source review before that revenue line launches.

**This is a working record, not legal advice.** It captures what each provider's
published terms say and what was done about it. Anything marked as needing a
lawyer still needs one.

Last reviewed: 18 August 2026.

## Summary

| Source | Status | Display with attribution | Redistribution / licensing | Reviewed | Notes |
|---|---|---|---|---|---|
| The Odds API | **cleared for display** | Yes, explicitly permitted including commercial use | Prohibited as a standalone data product | 18 Aug 2026 | See "own API" trap below. |
| Kalshi | **blocked, written permission needed** | Published terms say no, without prior written authorisation | Prohibited without written consent | 18 Aug 2026 | 16 live markets affected. Action outstanding. |
| Betfair Exchange | not reviewed | TBC | TBC | — | Ingest still blocked on an account flag, so nothing is displayed yet. Review before the first Betfair price ships. |
| ASX RBA Rate Tracker | **needs review** | TBC, published figure quoted widely by press with attribution | TBC | — | Scrape currently fails, so nothing is being retrieved. Confirm ASX terms on automated retrieval before fixing it. |
| Polymarket (phase 2, gated) | **legal review required before any public use** | — | — | — | Unchanged. ACMA-blocked in Australia. Internal reference only until a lawyer clears it. |

## The Odds API — cleared

Reviewed against https://the-odds-api.com/terms-and-conditions.html.

Display is explicitly permitted. Their terms support use of the data in
"websites, mobile apps, dashboards, analytical tools, and other user-facing
applications, including commercial use", provided the data is not your primary
product. Reckon is a media product that displays prices, so this fits.

What is prohibited is reselling, repackaging or redistributing the data "as a
standalone data product", which they define as including offering it through
your own API, data feed, or downloadable files.

**The trap to watch.** `/api/prices` is Reckon's own public endpoint. Today it
exists to serve Reckon's own front end, which is ordinary application
plumbing. If it were ever documented, advertised, or offered to third parties
as a feed, that is squarely "offering our data through your own API" and the
clearance above stops applying. Keep it undocumented and treat any request to
open it up as a terms question first, an engineering question second.

They also ask that anything promoting bookmakers carries responsible gambling
messaging. Reckon already runs the helpline footer on every page, so this is
satisfied, and Reckon does not promote operators at all.

Attribution wording is not prescribed. The current `contributing_books` display
naming the specific bookmakers is more than they require.

## Kalshi — blocked, and this one matters

Reviewed against the Kalshi Data Terms of Use
(https://kalshi-public-docs.s3.amazonaws.com/kalshi-data-terms-of-service.pdf).

**These terms do not permit what Reckon currently does.** Under permitted uses,
access is "only for your personal use for non-commercial purposes". Under
prohibited uses, without prior written authorisation you are barred from
"publicly displaying, publishing" or distributing Kalshi Data, which they
define to include bid-ask prices and settlement prices, exactly what the board
shows.

There is no media, journalism or fair-dealing carve-out in the document.

**One genuine ambiguity.** Those terms are written against content on the
kalshi.com website. Reckon does not scrape the website, it reads the public
API at `api.elections.kalshi.com/trade-api/v2`, which is plausibly governed by
the Member Agreement and any API terms instead. That difference might matter.
It is not the sort of question to resolve by reading it optimistically.

**Sixteen live markets depend on this**, roughly a third of the board: US
politics, crypto and F1.

### Action

Email Kalshi and ask for written permission to display their prices with
attribution as a media product. This is a normal request, exchanges generally
want price coverage, and written permission converts the whole question into a
filed email. Until it arrives, the honest options are:

1. Get the permission. Best outcome, and probably not hard.
2. Keep Kalshi markets out of the public launch and leave them in the database.
3. Launch with them and carry a known terms breach, which is not a defensible
   position for a brand whose pitch is accuracy and provenance.

Do not let option 3 happen by default through inaction.

## Betfair Exchange — review before first price ships

Nothing is displayed yet, because ingest is blocked on an account flag, so
there is no live exposure. Before the first Betfair price reaches the board,
confirm two separate things:

- Betfair's own terms on displaying exchange prices on a third-party site, and
  what attribution they require. The current attribution string is
  "Betfair Exchange, delayed".
- Australian gambling advertising rules. Betfair is a licensed operator here,
  and naming an operator carries considerations that Kalshi and The Odds API
  do not. The standing rule of no links and no sign-up CTAs already covers the
  worst of it, but naming the source on a card is worth a specific check.

## ASX RBA Rate Tracker — review before fixing the scrape

The scrape has never worked, so nothing is currently retrieved and there is no
live exposure. The figure itself is published and quoted widely by press with
attribution, which is a good sign but not a licence.

Confirm ASX website terms on automated retrieval **before** repairing the
scrape. If automated retrieval is not permitted, manual entry through
`/api/admin/set-price` with a note is the compliant path and is already built.

Current attribution string: "ASX 30 Day Interbank Cash Rate Futures, implied".

## Compliance posture (standing)

- No links to gambling operators anywhere on the product. No affiliate parameters. No wagering sign-up CTAs.
- Footer disclaimer + National Gambling Helpline 1800 858 858 on every page.
- Nothing that constitutes providing or advertising a gambling service under the Interactive Gambling Act. When in doubt, present less, attribute more.
- Accuracy claims must be provable from the prices_history / resolutions tables. No claimed track record the database cannot back.
- Every price carries its source and timestamp on the card. This is an editorial rule and it is also the thing that makes attribution automatic rather than something to remember.
