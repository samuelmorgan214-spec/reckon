-- Retire markets for events that have already happened.
-- Written 22 August 2026.
--
-- Run in the Supabase SQL editor. Copy from this file, not from a chat window.
--
-- Why these are still on the board: the odds ingester retires match markets
-- when they start, and the Kalshi ingester retires markets when they settle.
-- The Belgian GP markets retired themselves correctly through that path.
-- Outright markets from The Odds API have no retirement rule at all, so they
-- stay active indefinitely.
--
-- The Open Championship finished in July 2026 and the World Cup final was
-- July 2026, so all six of these are asking about settled events.
--
-- There is a worse failure hiding here. The Odds API sport key
-- golf_the_open_championship_winner rolls over to the next edition, so once
-- the 2027 market opens the ingester will happily write 2027 prices onto a
-- card that still asks about 2026. The ingest log already shows these four
-- updating with live prices after the tournament ended. Deactivating them
-- stops that. See the note in HANDOFF.md about a durable fix.

begin;

update markets set active = false
 where slug in (
   'the-open-2026-burns',
   'the-open-2026-herbert',
   'the-open-2026-kim',
   'the-open-2026-fox',
   'world-cup-2026-spain',
   'world-cup-2026-argentina'
 );

commit;

-- ---------------------------------------------------------------------------
-- Check what is left in the sports category
-- ---------------------------------------------------------------------------
-- select slug, question, active, source_config->>'provider' as provider
--   from markets
--  where category = 'sports'
--  order by active desc, slug;
--
-- Expect the two F1 constructors markets still active, everything else off.
-- The Belgian GP pair should already be inactive, retired by the Kalshi
-- ingester when the race settled.
--
-- ---------------------------------------------------------------------------
-- Find anything else that has quietly gone stale
-- ---------------------------------------------------------------------------
-- select m.slug, m.category, p.updated_at
--   from markets m
--   join prices_current p on p.market_id = m.id
--  where m.active
--  order by p.updated_at asc
--  limit 20;
--
-- Anything at the top of that list with an old timestamp is a market whose
-- source has stopped carrying it, which usually means the event is over.
