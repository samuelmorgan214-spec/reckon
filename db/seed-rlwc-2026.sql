-- Rugby League World Cup 2026, plus the 2027 NRL premiership.
-- Written 14 November 2026. Run in the Supabase SQL editor, copied from this
-- file rather than from a chat window.
--
-- The Odds API carries no rugby league at all right now, confirmed against its
-- live catalogue, so all of this comes from Betfair. Market ids and runner
-- names are verbatim from listMarketCatalogue, and Betfair is not consistent,
-- so do not tidy them: the womens runners really do carry a " Women" suffix,
-- the Storm really is "Melbourne", and the Sharks really are "Cronulla".
--
--   1.263537819  Mens 2026 World Cup Winner
--   1.263545580  Womens 2026 World Cup Winner
--   1.253336926  NRL "Premiers 2027"
--
-- Worth noting before you write about it: the exchange has New Zealand ahead
-- of Australia in the mens tournament. That is the sort of thing the board
-- exists to surface.

begin;

insert into markets (slug, question, category, source_type, source_config) values
  -- Mens Rugby League World Cup
  ('rlwc-2026-australia', 'Australia to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"Australia"}'),
  ('rlwc-2026-new-zealand', 'New Zealand to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"New Zealand"}'),
  ('rlwc-2026-england', 'England to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"England"}'),
  ('rlwc-2026-png', 'Papua New Guinea to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"Papua New Guinea"}'),
  ('rlwc-2026-fiji', 'Fiji to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"Fiji"}'),
  ('rlwc-2026-samoa', 'Samoa to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"Samoa"}'),
  ('rlwc-2026-tonga', 'Tonga to win the 2026 Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263537819","runner":"Tonga"}'),

  -- Womens Rugby League World Cup
  ('rlwc-w-2026-australia', 'Australia to win the 2026 Womens Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263545580","runner":"Australia Women"}'),
  ('rlwc-w-2026-new-zealand', 'New Zealand to win the 2026 Womens Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263545580","runner":"New Zealand Women"}'),
  ('rlwc-w-2026-england', 'England to win the 2026 Womens Rugby League World Cup', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.263545580","runner":"England Women"}'),

  -- NRL premiership 2027. Already open, and it refills the Futures tab, which
  -- emptied when the 2026 markets settled.
  ('nrl-premiership-2027-panthers', 'Panthers to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Penrith Panthers"}'),
  ('nrl-premiership-2027-roosters', 'Roosters to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Sydney Roosters"}'),
  ('nrl-premiership-2027-dolphins', 'Dolphins to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Dolphins"}'),
  ('nrl-premiership-2027-storm', 'Storm to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Melbourne"}'),
  ('nrl-premiership-2027-rabbitohs', 'Rabbitohs to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"South Sydney Rabbitohs"}'),
  ('nrl-premiership-2027-broncos', 'Broncos to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Brisbane Broncos"}'),
  ('nrl-premiership-2027-bulldogs', 'Bulldogs to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"Canterbury Bulldogs"}'),
  ('nrl-premiership-2027-warriors', 'Warriors to win the 2027 NRL premiership', 'nrl', 'exchange',
   '{"provider":"betfair","marketId":"1.253336926","runner":"New Zealand Warriors"}')
on conflict (slug) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Check
-- ---------------------------------------------------------------------------
-- Run the ingest and read the Betfair step. A runner name that does not match
-- logs "runner ... not in market" and costs nothing, so a typo shows up in the
-- log rather than breaking the board:
--   gh workflow run ingest.yml
--
-- These retire themselves. The Betfair ingester deactivates a market once the
-- exchange book is no longer OPEN, which is what cleared the 2026 premierships
-- when those seasons ended.
