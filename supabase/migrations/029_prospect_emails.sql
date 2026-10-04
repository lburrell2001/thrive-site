-- ============================================================
-- PROSPECT EMAILS — one-to-one outreach to potential clients
-- ============================================================
-- Unlike newsletters, a prospect email goes to one CRM contact at a time,
-- sent by Lauren from their page in the CRM. Templates come in two styles:
--   personal   reads like a note from Lauren: markdown text and a small
--              signature with the logo
--   designed   the newsletter block builder (images, buttons, columns)
--
-- Every prospect email carries an unsubscribe link and the mailing
-- address. Unsubscribing sets crm_contacts.newsletter_status to
-- 'unsubscribed', which also blocks any further prospect email.

create table if not exists public.prospect_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  style       text not null default 'personal' check (style in ('personal', 'designed')),
  subject     text not null default '',
  preheader   text not null default '',
  -- Personal style: the message, in the journal's markdown.
  body        text not null default '',
  -- Designed style: newsletter blocks and design.
  blocks      jsonb not null default '[]'::jsonb,
  design      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- What was actually sent, as sent (after Lauren's per-person edits).
create table if not exists public.prospect_emails (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references public.crm_contacts(id) on delete set null,
  template_id  uuid references public.prospect_templates(id) on delete set null,
  style        text not null check (style in ('personal', 'designed')),
  email        text not null,
  subject      text not null,
  body         text not null default '',
  status       text not null check (status in ('sent', 'failed')),
  error        text,
  resend_id    text,
  sent_at      timestamptz not null default now()
);

create index if not exists prospect_emails_contact_idx on public.prospect_emails (contact_id, sent_at desc);
create index if not exists prospect_emails_sent_idx on public.prospect_emails (sent_at desc);

-- Same posture as the CRM: RLS on, no policies; server routes only.
alter table public.prospect_templates enable row level security;
alter table public.prospect_emails    enable row level security;
