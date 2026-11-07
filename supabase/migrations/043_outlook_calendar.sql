-- ============================================================
-- OUTLOOK CALENDAR
-- ============================================================
-- The Outlook sync (src/lib/outlookCalendar.ts, every 5 minutes) also reads
-- Lauren's own Microsoft 365 calendar — from a week back to 60 days ahead —
-- so meetings she puts there (e.g. "Meeting with Maria", Thursday) show on
-- Home, the Calls page, the weekly digest and the contact's timeline.
--
-- An event is linked to a CRM contact by an attendee's email, else by the
-- contact's name in the title. Lauren can link or unlink one by hand
-- (contact_locked = true: the sync then leaves the link alone).
--
-- Events still in the window that were deleted in Outlook are removed. Past
-- events with no contact are removed after a week; meetings with a contact
-- stay as history.
--
-- Needs the Calendars.Read permission: reconnect Outlook in Settings → Email
-- once after this runs. RLS on, no policies. Safe to run more than once.

-- Which Microsoft permissions the current sign-in holds, space-separated, so
-- the token refresh never asks for one that wasn't granted (and the calendar
-- is only read once Calendars.Read is there).
alter table public.mail_connection
  add column if not exists granted_scopes text,
  add column if not exists calendar_synced_at timestamptz;

create table if not exists public.calendar_events (
  id               uuid primary key default gen_random_uuid(),
  -- Graph's event id; each occurrence of a repeating meeting has its own.
  graph_id         text not null unique,
  mailbox          text not null,
  subject          text not null default '',
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  is_all_day       boolean not null default false,
  location         text,
  join_url         text,
  web_link         text,
  organizer_email  text,
  -- [{ "email": "...", "name": "..." }], Lauren's own addresses left out.
  attendees        jsonb not null default '[]'::jsonb,
  contact_id       uuid references public.crm_contacts(id) on delete set null,
  -- 'email' | 'name' | 'manual'
  matched_by       text,
  contact_locked   boolean not null default false,
  synced_at        timestamptz not null default now()
);

create index if not exists calendar_events_starts_idx on public.calendar_events (starts_at);
create index if not exists calendar_events_contact_idx on public.calendar_events (contact_id, starts_at desc) where contact_id is not null;

alter table public.calendar_events enable row level security;
