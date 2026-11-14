-- Retire settled 2026 markets. Written 14 November 2026.
--
-- Run in the Supabase SQL editor. Copy from this file, not from a chat window.
--
-- This supersedes db/retire-finished-2026.sql, which was written in August and
-- never run. The problem it described has since got worse, so read this one.
--
-- ## The Open markets are now actively wrong, not merely stale
--
-- The Odds API sport key golf_the_open_championship_winner is still ACTIVE and
-- still carries outrights, confirmed against the live catalogue on 14 November
-- 2026. The 2026 tournament finished in July. The key has rolled over to the
-- next edition, so the ingester has been writing **2027 prices onto cards that
-- ask about 2026**. That is not a stale number, it is a wrong one, and it is
-- the exact failure predicted when these were first flagged in August.
--
-- ## Everything else here is simply over
--
-- World Cup final: July 2026. The feed carries no outrights for it any more.
-- AFL and NRL premierships: both seasons finished, and the Betfair ingester
-- already retired its own rows when the exchange markets closed, which is why
-- the last run reported "no active betfair markets configured".
--
-- The Kalshi ingester retires its own markets on settlement and has already
-- done so for the US midterms and the F1 constructors title.

begin;

-- 1. The Open 2026. Wrong, not just old.
update markets set active = false
 where source_config->>'sport' = 'golf_the_open_championship_winner';

-- 2. World Cup 2026. Settled in July.
update markets set active = false
 where source_config->>'sport' = 'soccer_fifa_world_cup_winner';

-- 3. Any remaining 2026 premiership rows, whichever provider they point at.
--    Safe if the Betfair ingester already deactivated them.
update markets set active = false
 where slug like 'afl-flag-2026-%'
    or slug like 'nrl-premiership-2026-%';

-- 4. State of Origin game three. The 2026 series is long finished and this row
--    is manual, so nothing was ever going to retire it automatically.
update markets set active = false
 where slug = 'nsw-origin-game-three';

commit;

-- ---------------------------------------------------------------------------
-- What should be left, and what fills the gap
-- ---------------------------------------------------------------------------
-- select category, count(*) filter (where active) as live,
--        count(*) filter (where not active) as retired
--   from markets group by category order by category;
--
-- Summer match markets seed themselves. ingest-odds now auto-syncs Big Bash,
-- Test cricket and the A-League alongside AFL and NRL, so those rows appear on
-- their own at the next run and retire themselves when each match starts.
--
-- Outright markets are curated and do NOT appear on their own. The live
-- catalogue has these available right now, each needing a row per outcome with
-- source_config {"provider":"odds_api","sport":"<key>","market":"outrights",
-- "outcome":"<exact name from the feed>"}:
--
--   basketball_nba_championship_winner        NBA Championship Winner
--   americanfootball_nfl_super_bowl_winner    NFL Super Bowl Winner
--   politics_us_presidential_election_winner  US Presidential Elections Winner
--
-- Outcome strings must match the feed exactly, so read them from
-- /api/cron/sports-probe before writing the rows rather than typing team names
-- from memory.
--
-- ---------------------------------------------------------------------------
-- Find the next one that goes stale before a reader does
-- ---------------------------------------------------------------------------
-- select m.slug, m.category, p.updated_at
--   from markets m join prices_current p on p.market_id = m.id
--  where m.active order by p.updated_at asc limit 20;
--
-- The dashboard at /dashboard shows the same thing as a banner.
