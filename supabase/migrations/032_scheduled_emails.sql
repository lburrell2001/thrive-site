-- ============================================================
-- SCHEDULED EMAILS — send later, and save one-to-one drafts
-- ============================================================
-- Audience emails (newsletters) gain a 'scheduled' status and the time to
-- send. Vercel Cron calls /api/cron/scheduled-emails every five minutes and
-- sends whatever is due; the audience is worked out at send time, so anyone
-- who unsubscribes in between is left out.
--
-- One-to-one emails (the Email button on a contact) gain drafts: what Lauren
-- wrote for one person, kept until she sends it, with an optional time to
-- send. Once sent, the draft is deleted and the email is recorded in
-- prospect_emails as before.

alter table public.newsletters drop constraint if exists newsletters_status_check;
alter table public.newsletters
  add constraint newsletters_status_check
  check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed'));
alter table public.newsletters add column if not exists scheduled_at timestamptz;

create index if not exists newsletters_scheduled_idx
  on public.newsletters (scheduled_at) where status = 'scheduled';

create table if not exists public.prospect_drafts (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  template_id   uuid references public.email_templates(id) on delete set null,
  subject       text not null default '',
  preheader     text not null default '',
  body          text not null default '',
  note          text not null default '',
  -- draft: saved, not going anywhere. scheduled: goes out at scheduled_at.
  -- sending: claimed by the cron. failed: the scheduled send didn't go.
  status        text not null default 'draft'
                check (status in ('draft', 'scheduled', 'sending', 'failed')),
  scheduled_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);

-- One draft per person: the Email button picks up where she left off.
create unique index if not exists prospect_drafts_contact_idx on public.prospect_drafts (contact_id);
create index if not exists prospect_drafts_scheduled_idx
  on public.prospect_drafts (scheduled_at) where status = 'scheduled';

-- Same posture as the CRM: RLS on, no policies; server routes only.
alter table public.prospect_drafts enable row level security;
