# Content and brand guide

What a new session needs to make Reckon content that looks and sounds right.
Read this plus the brand section of `HANDOFF.md`.

Last updated: 13 November 2026.

## The two accounts

Reckon runs **two social accounts off one identity**. Same look, different
angle. Do not mix them.

| | Angle | Covers |
|---|---|---|
| **Money account** | "The outcomes that impact your life" | Politics, interest rates, the stock market |
| **Sport account** | "Who actually wins it?" | AFL, NRL, the flag, the premiership |

The **website covers everything**, so site copy says "footy, politics, money
and markets". A carousel for the money account never mentions footy, and vice
versa. This has already caused one wrong edit: the site hero was narrowed to
"Politics. Money. Markets." and had to be put back.

## Identity

- **Two colours.** Forest green `#123D2E` ground, cream `#EDE7DA` text.
  Brighter cream `#FBF7EF` for emphasis. Resist adding a third.
- **Type is the contrast.** Playfair Display for headlines, Inter for labels,
  body and any number. A serif price looks wrong and loses the data feel.
- **Wordmark** is `reckon.` lowercase with the full stop, heavy Inter, cream.
  Top left, with the slide number top right as `01 / 04`.
- Up moves soft mint `#8FE0B4`, down moves warm terracotta `#E8947B`. Only
  ever on actual market moves.

## Carousel shape that worked

Four slides, and the structure carries the argument:

1. **The promise.** Big serif headline, the three-word category line, what the
   account is for. Closes on "A different perspective. A clearer view."
2. **A concrete question**, label in caps (POLITICS), serif headline as a
   question, photo, then the stakes in plain words.
3. **Same again, different domain**, so it reads as a beat rather than a list.
4. **The ask.** "Follow Reckon for what happens next."

Each slide: ALL-CAPS category label, serif question headline, one bold line of
"your mortgage, your savings, your next move" stakes, then one plain sentence.
Say what it means for the reader, never just what happened.

## Voice

- Plain confident Australian. **No em dashes, no semicolons.** Short sentences.
- Second person. "Your mortgage", "your super", "your club".
- The through line: the news and pundits say one thing, the markets say
  another. Lead with the market, not the commentary.
- Never hype a number. The number is the story, the adjective is not.

## Rules that are not style preferences

These come from the compliance posture and the editorial rules. Breaking them
is a real problem, not a taste call.

- **Never invent a number.** If no market prices it, say so. Reckon estimates
  are labelled as estimates, in amber on the site, and in words in a caption.
- **Every price carries its source and timestamp.** A screenshot of a card
  already does this. A number typed into a caption needs it added.
- **No links to gambling operators, ever.** No affiliate parameters, no
  wagering sign-up calls to action, no naming a bookmaker as somewhere to go.
- **Kalshi prices cannot be published publicly** until written permission
  arrives. Their data terms allow personal non-commercial use only. That is US
  politics, crypto and F1, so a crypto post is not currently safe. See
  `docs/source-terms.md`.
- The Odds API and Betfair are cleared for display with attribution.
- **No accuracy or track record claim** that `prices_history` cannot back.
  "We called it" needs a row in the database.
- Anything price-led carries the responsible gambling line. The `/comingsoon`
  teaser is the exception only because it shows no prices.

## Assets in the repo

- `reckon_avatar_square.svg`, `reckon_avatar_square_320.png` — the wordmark
  avatar, green ground, cream type.
- `reckon-card-maker.html` — generates share cards. **Still on the old blue
  and navy identity, needs restyling before use.**
- `reckon-instagram-pins.html` — pin/cover layouts. Same, still old identity.

## Where the numbers come from

Live prices are on the board at `/board`, behind the site password. The
dashboard at `/dashboard` shows whether the board is actually fresh before you
screenshot anything from it. A stale price in a post is worse than no post.
