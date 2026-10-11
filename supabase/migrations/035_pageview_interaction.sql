-- ============================================================
-- PAGE VIEW INTERACTION — tell people from bots
-- ============================================================
-- /api/track drops bots that say they are bots, but headless browsers
-- that pretend to be Chrome or Safari still run the tracker. A person
-- scrolls, taps, clicks or types; a bot that loads the page almost never
-- does. SiteTracker reports the first interaction on each page, and the
-- admin reports (src/lib/botFilter.ts) count a session as a real visit
-- only once it has one.
--
-- Rows recorded before this stay null and are judged by the older rules
-- (data-center towns, one page with no time on it).

alter table public.site_pageviews
  add column if not exists interacted boolean;

-- New rows start false; existing rows keep null.
alter table public.site_pageviews
  alter column interacted set default false;
