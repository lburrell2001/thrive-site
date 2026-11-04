-- ============================================================
-- OUTLOOK INBOX AND GOOGLE VOICE
-- ============================================================
-- The CRM connects to Lauren's Microsoft 365 mailbox through Microsoft
-- Graph (src/lib/outlook.ts). Every 5 minutes it reads new mail in the
-- Inbox and Sent Items and keeps only what involves a CRM contact:
--
--   * mail from a contact → email_replies (the same table Resend replies
--     use), so it shows on Today and the timeline and a prospect who writes
--     becomes a New lead;
--   * mail Lauren sent from Outlook herself → outlook_sent (mail the CRM
--     sent is already in prospect_emails / client_reminders);
--   * Google Voice alerts forwarded into the inbox (texts, voicemails,
--     missed calls) → voice_events, plus a crm_activities row on the
--     contact matched by phone number (kind 'text', or 'call').
--
-- One-to-one CRM emails and reminders then send from the mailbox itself.
--
-- All three tables: RLS on, no policies. Safe to run more than once.

-- The one Microsoft sign-in (Lauren's own account). Other mailboxes she has
-- Full Access to, such as hello@, are read through it (shared_mailboxes).
-- The refresh token is AES-256-GCM encrypted with PORTAL_CREDENTIALS_KEY
-- (credentialCrypto.ts).
create table if not exists public.mail_connection (
  id             int primary key default 1 check (id = 1),
  provider       text not null default 'outlook',
  account_email  text not null,
  refresh_token  text not null,
  connected_at   timestamptz not null default now(),
  last_sync_at   timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);

alter table public.mail_connection
  -- Other mailboxes to read, lowercased: {hello@thrivecreativestudios.org}.
  add column if not exists shared_mailboxes text[] not null default '{}',
  -- Which mailbox CRM email goes from; null = the signed-in account.
  add column if not exists send_from text,
  -- Read up to here, per mailbox and folder:
  -- { "<mailbox>": { "inbox": "<iso>", "sentitems": "<iso>" } }.
  add column if not exists cursors jsonb not null default '{}'::jsonb;

create table if not exists public.outlook_sent (
  id                   uuid primary key default gen_random_uuid(),
  internet_message_id  text not null,
  contact_id           uuid not null references public.crm_contacts(id) on delete cascade,
  to_email             text not null,
  subject              text not null default '',
  preview              text not null default '',
  web_link             text,
  sent_at              timestamptz not null,
  -- One email to two contacts is a row for each.
  unique (internet_message_id, contact_id)
);

create index if not exists outlook_sent_contact_idx on public.outlook_sent (contact_id, sent_at desc);

create table if not exists public.voice_events (
  id           uuid primary key default gen_random_uuid(),
  -- The forwarded email's Internet Message-ID: each alert is handled once.
  source_id    text not null unique,
  kind         text not null check (kind in ('text', 'voicemail', 'missed_call')),
  phone        text,
  caller_name  text,
  body         text not null default '',
  occurred_at  timestamptz not null,
  contact_id   uuid references public.crm_contacts(id) on delete set null,
  activity_id  uuid references public.crm_activities(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists voice_events_unmatched_idx on public.voice_events (occurred_at desc) where contact_id is null;

-- How a one-to-one email went out: 'resend' (before) or 'outlook'.
alter table public.prospect_emails add column if not exists sent_via text;

alter table public.mail_connection enable row level security;
alter table public.outlook_sent enable row level security;
alter table public.voice_events enable row level security;
revoke all on public.mail_connection, public.outlook_sent, public.voice_events from anon, authenticated;
