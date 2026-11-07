-- ============================================================
-- OUTLOOK CALENDAR: BUSY OR FREE
-- ============================================================
-- /book now leaves out times that are busy on Lauren's Outlook calendar
-- (src/lib/booking.ts). Outlook marks each event free / tentative / busy /
-- oof (out of office) / workingElsewhere; only free and workingElsewhere
-- leave the time open. Rows synced before this have no value and count as
-- busy until the next sync (within 5 minutes) fills it in.
-- Needs migration 043. Safe to run more than once.

alter table public.calendar_events
  add column if not exists show_as text;

create index if not exists calendar_events_ends_idx on public.calendar_events (ends_at);
