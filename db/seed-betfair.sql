-- Betfair premiership and Australian politics markets.
-- Written 22 August 2026, after the Betfair ingest finally authenticated.
--
-- Run this in the Supabase SQL editor. Copy it from this file, not from a
-- terminal or a chat window, which has produced confusing syntax errors before.
--
-- Two things this fixes:
--
-- 1. The existing premiership rows point at The Odds API, which does not carry
--    AFL or NRL outrights at all. Confirmed against their full sport catalogue,
--    and visible in every ingest log as "no outrights yet (HTTP 404)". Those
--    rows have therefore never had a price. They are repointed at Betfair.
--
-- 2. The seeded teams were stale. Collingwood, Brisbane, Carlton and Geelong
--    were the 2026 favourites when seeded. Betfair now has Fremantle shortest,
--    then Brisbane and Hawthorn, so the obvious contenders are added.
--
-- Runner names must match Betfair exactly, and Betfair is not consistent
-- between codes. AFL uses short forms ("Brisbane", "Collingwood"), NRL mostly
-- uses full club names ("Penrith Panthers") but not always: the Storm is
-- "Melbourne" and the Sharks are "Cronulla". These are taken verbatim from
-- listMarketCatalogue, so do not tidy them up.
--
-- Betfair market ids used here:
--   1.248306161  AFL "Premiers 2026", 18 runners
--   1.248657355  NRL "Premiers 2026", 17 runners
--   1.244485042  "Australia - Federal Politics", "Next Federal Election"
--
-- Market ids change every season. When the 2027 markets open, rerun
-- /api/cron/betfair-probe and update them.

begin;

-- ---------------------------------------------------------------------------
-- 1. Repoint the existing premiership rows at Betfair
-- ---------------------------------------------------------------------------

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248306161","runner":"Collingwood"}'
  where slug = 'afl-flag-2026-collingwood';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248306161","runner":"Brisbane"}'
  where slug = 'afl-flag-2026-lions';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248306161","runner":"Carlton"}'
  where slug = 'afl-flag-2026-carlton';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248306161","runner":"Geelong"}'
  where slug = 'afl-flag-2026-geelong';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248657355","runner":"Penrith Panthers"}'
  where slug = 'nrl-premiership-2026-panthers';

-- Betfair calls the Storm "Melbourne", not "Melbourne Storm".
update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248657355","runner":"Melbourne"}'
  where slug = 'nrl-premiership-2026-storm';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248657355","runner":"Brisbane Broncos"}'
  where slug = 'nrl-premiership-2026-broncos';

update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.248657355","runner":"Canberra Raiders"}'
  where slug = 'nrl-premiership-2026-raiders';

-- This one was a manual Reckon estimate because no market priced it. Betfair
-- does, so it becomes a real traded price. That is the editorial rule working
-- as intended: a market beats an estimate whenever one exists.
update markets set source_type = 'exchange',
  source_config = '{"provider":"betfair","marketId":"1.244485042","runner":"Labor"}'
  where slug = 'federal-election-labor';

-- ---------------------------------------------------------------------------
-- 2. Add the contenders that were missing
-- ---------------------------------------------------------------------------

insert into markets (slug, question, category, source_type, source_config) values
  ('afl-flag-2026-fremantle', 'Fremantle to win the 2026 AFL flag', 'afl', 'exchange',
   '{"provider":"betfair","marketId":"1.248306161","runner":"Fremantle"}'),
  ('afl-flag-2026-hawthorn', 'Hawthorn to win the 2026 AFL flag', 'afl', 'exchange',
   '{"provider":"betfair","marketId":"1.248306161","runner":"Hawthorn"}'),
  ('afl-flag-2026-melbourne', 'Melbourne to win the 2026 AFL flag', 'afl', 'exchange',
   '{"provider":"betfair","marketId":"1.248306161","runner":"Melbourne"}'),
  ('afl-flag-2026-adelaide', 'Adelaide to win the 2026 AFL flag', 'afl', 'exchange',
   '{"provider":"betfair","marketId":"1.248306161","runner":"Adelaide"}'),
  ('afl-flag-2026-sydney', 'Sydney to win the 2026 AFL flag', 'afl', 'exchange',
   '{"provider":"betfair","marketId":"1.248306161","runner":"Sydney"}'),
  ('nrl-premiership-2026-roosters', 'Roosters to win the 2026 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.248657355","runner":"Sydney Roosters"}'),
  ('nrl-premiership-2026-warriors', 'Warriors to win the 2026 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.248657355","runner":"New Zealand Warriors"}'),
  ('nrl-premiership-2026-dolphins', 'Dolphins to win the 2026 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.248657355","runner":"Dolphins"}'),
  ('nrl-premiership-2026-sharks', 'Cronulla to win the 2026 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.248657355","runner":"Cronulla"}')
on conflict (slug) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Check it worked
-- ---------------------------------------------------------------------------
-- select slug, source_type, source_config->>'runner' as runner, active
--   from markets
--  where source_config->>'provider' = 'betfair'
--  order by category, slug;
--
-- Expect 18 rows. Then run the ingest and the prices appear:
--   gh workflow run ingest.yml
--
-- Any runner name that does not match logs "runner ... not in market <id>"
-- rather than failing, so a typo shows up in the run log and costs nothing.
