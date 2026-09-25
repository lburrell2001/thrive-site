-- ============================================================
-- NEWSLETTER — subscriptions on CRM contacts, and campaigns
-- ============================================================
-- Who may be emailed is a property of the contact:
--   pending       signed up in the footer, has not clicked the confirm link
--   subscribed    confirmed, or added by Lauren with a note of how they agreed
--   unsubscribed  said no; never emailed again unless they sign up again
--   null          never asked — not on the list
-- Only 'subscribed' contacts receive newsletters.
--
-- Each send is recorded per contact, with a unique (newsletter, contact)
-- pair, so a retried send can never email anyone twice.

alter table public.crm_contacts
  add column if not exists newsletter_status text
    check (newsletter_status in ('pending', 'subscribed', 'unsubscribed')),
  -- 'footer' | 'booking' | 'admin' | 'import'
  add column if not exists newsletter_source text,
  -- For contacts Lauren adds: how they agreed ("said yes on our call 9/25").
  add column if not exists newsletter_consent_note text,
  add column if not exists newsletter_subscribed_at timestamptz,
  add column if not exists newsletter_unsubscribed_at timestamptz,
  add column if not exists newsletter_confirm_sent_at timestamptz;

create index if not exists crm_contacts_newsletter_idx
  on public.crm_contacts (newsletter_status) where newsletter_status = 'subscribed';

create or replace function public.crm_contacts_newsletter_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.newsletter_status is distinct from old.newsletter_status then
    if new.newsletter_status = 'subscribed' then
      new.newsletter_subscribed_at := now();
    elsif new.newsletter_status = 'unsubscribed' then
      new.newsletter_unsubscribed_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists crm_contacts_newsletter_stamp on public.crm_contacts;
create trigger crm_contacts_newsletter_stamp
  before update of newsletter_status on public.crm_contacts
  for each row execute function public.crm_contacts_newsletter_stamp();

create table if not exists public.newsletters (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null default '',
  -- The grey line inboxes show after the subject.
  preheader       text not null default '',
  body            text not null default '',
  -- 'subscribers' | 'clients' | 'leads' | 'tag'
  audience        text not null default 'subscribers'
                  check (audience in ('subscribers', 'clients', 'leads', 'tag')),
  audience_tag    text,
  status          text not null default 'draft'
                  check (status in ('draft', 'sending', 'sent', 'failed')),
  last_error      text,
  recipient_count integer not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.newsletter_sends (
  id             uuid primary key default gen_random_uuid(),
  newsletter_id  uuid not null references public.newsletters(id) on delete cascade,
  contact_id     uuid references public.crm_contacts(id) on delete set null,
  email          text not null,
  status         text not null check (status in ('sent', 'failed')),
  error          text,
  resend_id      text,
  sent_at        timestamptz not null default now(),
  unique (newsletter_id, contact_id)
);

create index if not exists newsletter_sends_contact_idx on public.newsletter_sends (contact_id, sent_at desc);

-- Same posture as the CRM: RLS on, no policies. Signup, confirm and
-- unsubscribe go through server routes with signed tokens.
alter table public.newsletters      enable row level security;
alter table public.newsletter_sends enable row level security;
