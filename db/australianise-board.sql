-- Clear the settled markets and put Australian questions on the board.
-- Written 14 November 2026. Run in the Supabase SQL editor, copied from this
-- file rather than from a chat window.
--
-- Supersedes db/retire-finished-2026.sql and db/retire-2026-season.sql, both
-- of which were written and never run. Everything they did is included here.

begin;

-- ---------------------------------------------------------------------------
-- 1. Get the settled markets off the board
-- ---------------------------------------------------------------------------

-- The Open. This is the urgent one. The sport key
-- golf_the_open_championship_winner is still active in the Odds API and has
-- rolled over to the next edition, so every run writes 2027 prices onto cards
-- asking about the 2026 tournament, which finished in July. Sam Burns at 1.7%
-- is a live price for the wrong year.
update markets set active = false
 where source_config->>'sport' = 'golf_the_open_championship_winner';

-- Settled in July 2026.
update markets set active = false
 where source_config->>'sport' = 'soccer_fifa_world_cup_winner';

-- Both seasons are over. The Betfair ingester already retired its own rows
-- when the exchange markets closed, so this is belt and braces.
update markets set active = false
 where slug like 'afl-flag-2026-%'
    or slug like 'nrl-premiership-2026-%'
    or slug = 'nsw-origin-game-three';

-- ---------------------------------------------------------------------------
-- 2. Australian politics, priced by Betfair
-- ---------------------------------------------------------------------------
-- Market ids and runner names read from listMarketCatalogue. Betfair runner
-- strings must match exactly, so these are verbatim.
--
--   1.244485042  Australia - Federal Politics, "Next Federal Election"
--                runners: Labor, Coalition, Any Other Result
--   1.240828208  Australia - Victoria State Politics,
--                "Victorian State Election 2026"
--                runners: Coalition, Labor, Any Other, Liberal
--
-- The Victorian election is the most immediately Australian thing available:
-- a real state election, priced by a real exchange, while every pundit in
-- Melbourne guesses. Exactly the Reckon pitch.

update markets set active = true, source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.244485042","runner":"Labor"}'
  where slug = 'federal-election-labor';

insert into markets (slug, question, category, source_type, source_config) values
  ('federal-election-coalition', 'Coalition to win the next federal election', 'politics', 'exchange',
   '{"provider":"betfair","marketId":"1.244485042","runner":"Coalition"}'),
  ('vic-election-2026-labor', 'Labor to win the 2026 Victorian state election', 'politics', 'exchange',
   '{"provider":"betfair","marketId":"1.240828208","runner":"Labor"}'),
  ('vic-election-2026-coalition', 'Coalition to win the 2026 Victorian state election', 'politics', 'exchange',
   '{"provider":"betfair","marketId":"1.240828208","runner":"Coalition"}')
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- 3. One crypto market, not ten
-- ---------------------------------------------------------------------------
-- Ten crypto markets against a handful of Australian ones does not read as
-- Australian prediction-market media, it reads as a crypto site. One keeps the
-- category present as context without it dominating the board.
--
-- Kept: btc-100k-2026, the most recognisable version of the question.
-- Retired: the other nine, including the eth ladder and the 2027 Satoshi
-- market. All were Kalshi, all low-probability, and all settle within weeks
-- anyway, at which point the Kalshi ingester would have retired them itself.
--
-- Worth knowing: the one that survives is still a Kalshi price, and
-- docs/source-terms.md says those cannot be displayed publicly until written
-- permission arrives. Fine behind the gate, a decision to make before launch.

update markets set active = false
 where source_config->>'provider' = 'kalshi'
   and category = 'crypto'
   and slug <> 'btc-100k-2026';

commit;

-- ---------------------------------------------------------------------------
-- Check
-- ---------------------------------------------------------------------------
-- select category, count(*) filter (where active) as live
--   from markets group by category order by category;
--
-- Then run the ingest and read the Betfair step. A runner name that does not
-- match logs "runner ... not in market" and costs nothing, so a typo shows up
-- in the log rather than breaking anything:
--   gh workflow run ingest.yml
