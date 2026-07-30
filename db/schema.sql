-- Reckon Phase 1 schema (Postgres / Supabase)
-- Run this in the Supabase SQL editor on a fresh project.

-- A question Reckon tracks
create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- 'rba-cut-august-2026'
  question text not null,               -- 'RBA to cut the cash rate in August'
  category text not null check (category in ('afl','nrl','sports','politics','economy','crypto','culture')),
  source_type text not null,            -- 'bookmaker-consensus' | 'exchange' | 'futures-implied' | 'manual'
  source_config jsonb not null,         -- e.g. {"provider":"odds_api","sport":"aussierules_afl","market":"h2h",...}
  active boolean default true,
  created_at timestamptz default now()
);

-- Latest price per market (fast reads for the site)
create table if not exists prices_current (
  market_id uuid primary key references markets(id),
  probability numeric(5,4) not null,    -- 0.6800
  source_label text not null,
  contributing_books int,               -- null for non-consensus sources
  updated_at timestamptz not null
);

-- Every snapshot ever (the asset)
create table if not exists prices_history (
  id bigint generated always as identity primary key,
  market_id uuid references markets(id),
  probability numeric(5,4) not null,
  raw jsonb,                            -- per-book de-vigged values, exchange depth, etc.
  captured_at timestamptz not null default now()
);
create index if not exists prices_history_market_time on prices_history (market_id, captured_at);

-- Outcomes for calibration
create table if not exists resolutions (
  market_id uuid primary key references markets(id),
  outcome boolean not null,             -- did the event happen
  resolved_at timestamptz not null,
  resolution_note text                  -- source of truth for the outcome
);

-- Email capture. The list is the priority asset. Provider-agnostic by design:
-- the site POSTs here and a provider (Buttondown/ConvertKit/etc) can sync later.
create table if not exists subscribers (
  id bigint generated always as identity primary key,
  email text unique not null,
  source text default 'site',
  created_at timestamptz default now()
);

-- Reader votes. "What do you reckon?" Yeah/Nah per market. One row per
-- (market, anonymous browser id) so re-voting updates rather than stacks.
-- This is the crowd's opinion, kept separate from the market price.
create table if not exists votes (
  id bigint generated always as identity primary key,
  market_slug text not null,
  voter_id text not null,
  choice text not null check (choice in ('yes','no')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (market_slug, voter_id)
);
create index if not exists votes_slug on votes (market_slug);

-- Aggregated tally per market for fast reads on the site.
create or replace view vote_tallies as
select
  market_slug,
  count(*) filter (where choice = 'yes') as yes_votes,
  count(*) filter (where choice = 'no') as no_votes
from votes
group by market_slug;

-- Movement helper: current price plus the price ~7 days ago
-- (falls back to the earliest snapshot when the market is younger than the window).
create or replace view market_movement as
select
  m.id as market_id,
  pc.probability as current_probability,
  coalesce(
    (select ph.probability from prices_history ph
      where ph.market_id = m.id and ph.captured_at <= now() - interval '7 days'
      order by ph.captured_at desc limit 1),
    (select ph.probability from prices_history ph
      where ph.market_id = m.id
      order by ph.captured_at asc limit 1)
  ) as probability_then
from markets m
join prices_current pc on pc.market_id = m.id;

-- ---------------------------------------------------------------------------
-- Seed markets.
-- Outright (futures) sport keys on The Odds API only appear when the feed
-- activates them for the season. The ingester skips missing sports quietly,
-- so these seeds go live on their own once the feed carries them.
-- Verify key names against GET /v4/sports when they activate.
-- ---------------------------------------------------------------------------
insert into markets (slug, question, category, source_type, source_config) values
  ('rba-cut-next-meeting', 'RBA to cut the cash rate at the next meeting', 'economy', 'futures-implied',
   '{"provider":"asx_rate_tracker"}'),
  ('nrl-premiership-2026-panthers', 'Panthers to win the 2026 NRL premiership', 'nrl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"rugbyleague_nrl_premiership_winner","market":"outrights","outcome":"Penrith Panthers"}'),
  ('afl-flag-2026-collingwood', 'Collingwood to win the 2026 AFL flag', 'afl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"aussierules_afl_premiership_winner","market":"outrights","outcome":"Collingwood Magpies"}'),
  ('nrl-premiership-2026-storm', 'Storm to win the 2026 NRL premiership', 'nrl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"rugbyleague_nrl_premiership_winner","market":"outrights","outcome":"Melbourne Storm"}'),
  ('nrl-premiership-2026-broncos', 'Broncos to win the 2026 NRL premiership', 'nrl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"rugbyleague_nrl_premiership_winner","market":"outrights","outcome":"Brisbane Broncos"}'),
  ('nrl-premiership-2026-raiders', 'Raiders to win the 2026 NRL premiership', 'nrl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"rugbyleague_nrl_premiership_winner","market":"outrights","outcome":"Canberra Raiders"}'),
  ('afl-flag-2026-lions', 'Brisbane Lions to win the 2026 AFL flag', 'afl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"aussierules_afl_premiership_winner","market":"outrights","outcome":"Brisbane Lions"}'),
  ('afl-flag-2026-carlton', 'Carlton to win the 2026 AFL flag', 'afl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"aussierules_afl_premiership_winner","market":"outrights","outcome":"Carlton Blues"}'),
  ('afl-flag-2026-geelong', 'Geelong to win the 2026 AFL flag', 'afl', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"aussierules_afl_premiership_winner","market":"outrights","outcome":"Geelong Cats"}'),
  ('nsw-origin-game-three', 'NSW to win State of Origin game three', 'nrl', 'manual',
   '{"provider":"manual","resolution":"match result, Origin game three"}'),
  ('richmond-wooden-spoon-2026', 'Richmond to take the AFL wooden spoon', 'afl', 'manual',
   '{"provider":"manual","resolution":"AFL ladder, last place after the home-and-away season"}'),
  ('federal-election-labor', 'Labor to win the next federal election', 'politics', 'manual',
   '{"provider":"manual","note":"update via /api/admin/set-price until Betfair exchange lands in phase 2"}'),
  ('gambling-ad-ban-jan-2027', 'Gambling ad ban expanded before January 2027', 'politics', 'manual',
   '{"provider":"manual"}'),
  -- Australian politics conversation markets. Manual editorial estimates until the
  -- Betfair exchange integration lands in phase 2 (the natural source for these).
  -- The only Kalshi Australian politics market has ~$24 open interest, too thin to quote.
  ('one-nation-house-seat', 'One Nation to win a House of Reps seat at the next election', 'politics', 'manual',
   '{"provider":"manual","resolution":"AEC declared results, next federal election"}'),
  ('one-nation-primary-10pc', 'One Nation to top 10% of the primary vote at the next election', 'politics', 'manual',
   '{"provider":"manual","resolution":"AEC first-preference national House vote share"}'),
  ('opposition-leadership-change-2026', 'Leadership change in the opposition this year', 'politics', 'manual',
   '{"provider":"manual","resolution":"any change of federal opposition leader before Dec 31"}'),
  -- Economy conversation markets. Manual until a market source covers them.
  -- The RBA-cut question is already live above via ASX futures (rba-cut-next-meeting).
  ('inflation-under-3pc-christmas', 'Inflation under 3% at the last print before Christmas', 'economy', 'manual',
   '{"provider":"manual","resolution":"ABS annual CPI indicator, final release before Dec 25"}'),
  ('brisbane-over-melbourne-prices', 'Brisbane home values above Melbourne at the December print', 'economy', 'manual',
   '{"provider":"manual","resolution":"CoreLogic median dwelling value, December release"}'),
  -- US politics context cards. Kalshi exchange prices, quoted as-is (no margin to remove).
  -- Tickers verified live 2026-07-13.
  ('us-house-democrats-2026', 'Democrats to win the US House at the midterms', 'politics', 'exchange',
   '{"provider":"kalshi","ticker":"CONTROLH-2026-D"}'),
  ('us-senate-democrats-2026', 'Democrats to win the US Senate at the midterms', 'politics', 'exchange',
   '{"provider":"kalshi","ticker":"CONTROLS-2026-D"}'),
  ('us-president-2028-democrats', 'Democrats to take the White House in 2028', 'politics', 'exchange',
   '{"provider":"kalshi","ticker":"KXPRESPARTY-2028-D"}'),
  ('albanese-pm-at-christmas', 'Albanese still PM at Christmas', 'politics', 'manual',
   '{"provider":"manual","resolution":"sitting PM on Dec 25"}'),
  ('early-federal-election-2026', 'A federal election called this year', 'politics', 'manual',
   '{"provider":"manual","resolution":"writs issued before Dec 31"}'),
  -- Economy conversation markets, manual until sourced. US context cards via Kalshi.
  ('unemployment-above-45-next-print', 'Unemployment above 4.5% at the next print', 'economy', 'manual',
   '{"provider":"manual","resolution":"ABS labour force release, seasonally adjusted"}'),
  ('sydney-house-prices-up-yoy', 'Sydney home values up year on year at the next print', 'economy', 'manual',
   '{"provider":"manual","resolution":"CoreLogic monthly index"}'),
  ('cash-rate-below-3-eoy', 'Cash rate below 3% by year end', 'economy', 'manual',
   '{"provider":"manual","resolution":"RBA cash rate target on Dec 31"}'),
  ('asx200-above-9000-eoy', 'ASX 200 to finish the year above 9,000', 'economy', 'manual',
   '{"provider":"manual","resolution":"ASX 200 close, last trading day"}'),
  ('wages-beat-inflation-2026', 'Wages growth to beat inflation this year', 'economy', 'manual',
   '{"provider":"manual","resolution":"ABS WPI annual vs CPI annual, December quarter"}'),
  ('aud-above-70c-eoy', 'Aussie dollar above 70 US cents at year end', 'economy', 'manual',
   '{"provider":"manual","resolution":"AUD/USD at Dec 31 close"}'),
  ('us-recession-2026', 'US recession called in 2026', 'economy', 'exchange',
   '{"provider":"kalshi","ticker":"KXRECSSNBER-26"}'),
  -- Sports (beyond footy). Mixed sources, all verified live 2026-07-13.
  -- Topical markets: retire (active=false) and record the resolution once each event settles.
  -- The two World Cup finalists and The Open run off Odds API outright consensus;
  -- F1 runs off Kalshi. Kalshi markets auto-retire via the ingester when settled.
  ('world-cup-2026-spain', 'Spain to lift the World Cup', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"soccer_fifa_world_cup_winner","market":"outrights","outcome":"Spain"}'),
  ('world-cup-2026-argentina', 'Argentina to lift the World Cup', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"soccer_fifa_world_cup_winner","market":"outrights","outcome":"Argentina"}'),
  ('the-open-2026-burns', 'Sam Burns to win The Open', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"golf_the_open_championship_winner","market":"outrights","outcome":"Sam Burns"}'),
  ('the-open-2026-herbert', 'Aussie Lucas Herbert to win The Open', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"golf_the_open_championship_winner","market":"outrights","outcome":"Lucas Herbert"}'),
  ('f1-belgian-gp-antonelli', 'Antonelli to win the Belgian Grand Prix', 'sports', 'exchange',
   '{"provider":"kalshi","ticker":"KXF1RACE-BELGP26-ANT"}'),
  ('f1-constructors-2026-mercedes', 'Mercedes to take the F1 constructors title', 'sports', 'exchange',
   '{"provider":"kalshi","ticker":"KXF1CONSTRUCTORS-26-MER"}'),
  ('the-open-2026-kim', 'Si Woo Kim to win The Open', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"golf_the_open_championship_winner","market":"outrights","outcome":"Si Woo Kim"}'),
  ('the-open-2026-fox', 'Ryan Fox to win The Open', 'sports', 'bookmaker-consensus',
   '{"provider":"odds_api","sport":"golf_the_open_championship_winner","market":"outrights","outcome":"Ryan Fox"}'),
  ('f1-belgian-gp-verstappen', 'Verstappen to win the Belgian Grand Prix', 'sports', 'exchange',
   '{"provider":"kalshi","ticker":"KXF1RACE-BELGP26-VER"}'),
  ('f1-constructors-2026-ferrari', 'Ferrari to take the F1 constructors title', 'sports', 'exchange',
   '{"provider":"kalshi","ticker":"KXF1CONSTRUCTORS-26-FER"}'),
  -- Crypto. Kalshi exchange prices, quoted as-is. Tickers verified live 2026-07-13.
  -- Year-max ladders resolve strike by strike, so refresh these seeds each January.
  ('btc-100k-2026', 'Bitcoin to top US$100k this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXBTCMAXY-26DEC31-99999.99"}'),
  ('btc-150k-2026', 'Bitcoin to top US$150k this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXBTCMAXY-26DEC31-149999.99"}'),
  ('btc-under-50k-2026', 'Bitcoin to dip under US$50k this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXBTCMINY-27JAN01-50000.00"}'),
  ('eth-3500-2026', 'Ethereum to top US$3,500 this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXETHMAXY-27JAN01-3500.00"}'),
  ('eth-under-1250-2026', 'Ethereum to dip under US$1,250 this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXETHMINY-27JAN01-1250"}'),
  ('satoshi-moves-btc-2027', 'Satoshi''s coins to move before 2027', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXSATOSHIBTCYEAR-27"}'),
  ('btc-110k-2026', 'Bitcoin to top US$110k this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXBTCMAXY-26DEC31-109999.99"}'),
  ('btc-under-40k-2026', 'Bitcoin to dip under US$40k this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXBTCMINY-27JAN01-40000.00"}'),
  ('eth-4000-2026', 'Ethereum to top US$4,000 this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXETHMAXY-27JAN01-4000.00"}'),
  ('eth-under-1000-2026', 'Ethereum to dip under US$1,000 this year', 'crypto', 'exchange',
   '{"provider":"kalshi","ticker":"KXETHMINY-27JAN01-1000"}')
on conflict (slug) do nothing;
