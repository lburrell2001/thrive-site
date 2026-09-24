-- ============================================================
-- BOOK A CALL — short intro calls booked from the website
-- ============================================================
-- Lauren sets weekly hours; visitors pick an open slot at /book. A booking
-- is also written as a contact_inquiries row, so the CRM treats it like any
-- other lead (contact, deal, dashboard, analytics attribution) without a
-- second path.
--
-- No calendar sync: availability is the weekly hours minus blocked dates
-- and existing bookings. Every booking sends a calendar invite.

create table if not exists public.booking_settings (
  id                 smallint primary key default 1 check (id = 1),
  enabled            boolean not null default false,
  title              text not null default '15-minute intro call',
  duration_minutes   smallint not null default 15 check (duration_minutes between 10 and 120),
  -- Free time kept after each call before the next one can start.
  buffer_minutes     smallint not null default 15 check (buffer_minutes between 0 and 120),
  min_notice_hours   smallint not null default 24 check (min_notice_hours between 0 and 336),
  max_days_ahead     smallint not null default 21 check (max_days_ahead between 1 and 90),
  timezone           text not null default 'America/Chicago',
  -- {"mon":[{"start":"10:00","end":"16:00"}], "tue":[...], ...}
  weekly_hours       jsonb not null default
    '{"mon":[{"start":"10:00","end":"16:00"}],"tue":[{"start":"10:00","end":"16:00"}],"wed":[{"start":"10:00","end":"16:00"}],"thu":[{"start":"10:00","end":"16:00"}],"fri":[]}'::jsonb,
  -- Where the call happens: a standing Zoom/Meet link, or "I'll call you".
  meeting_link       text,
  meeting_note       text not null default 'You''ll get a video link by email before the call.',
  updated_at         timestamptz not null default now()
);

insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.booking_blackouts (
  id         uuid primary key default gen_random_uuid(),
  starts_on  date not null,
  ends_on    date not null,
  note       text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  -- For the visitor's own cancel link.
  token           text not null unique,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  name            text not null,
  email           text not null,
  company         text,
  phone           text,
  service_slug    text,
  notes           text,
  -- The visitor's own time zone, for their emails.
  visitor_tz      text,
  inquiry_id      uuid references public.contact_inquiries(id) on delete set null,
  crm_contact_id  uuid references public.crm_contacts(id) on delete set null,
  crm_deal_id     uuid references public.crm_deals(id) on delete set null,
  crm_task_id     uuid references public.crm_tasks(id) on delete set null,
  cancelled_at    timestamptz,
  cancelled_by    text,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Two visitors cannot hold the same start time.
create unique index if not exists bookings_one_per_slot
  on public.bookings (starts_at) where status = 'confirmed';
create index if not exists bookings_upcoming_idx
  on public.bookings (starts_at) where status = 'confirmed';

-- RLS on, no policies: availability and booking go through server routes,
-- which never expose other visitors' details.
alter table public.booking_settings  enable row level security;
alter table public.booking_blackouts enable row level security;
alter table public.bookings          enable row level security;
