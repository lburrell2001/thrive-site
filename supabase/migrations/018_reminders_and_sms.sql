-- ============================================================
-- REMINDERS AND TEXT MESSAGE NOTIFICATIONS
-- ============================================================
-- Admin can nudge a client about an unpaid invoice, an unsigned proposal,
-- unfinished onboarding, or anything else, by email and/or text.
--
-- Texting a client needs their consent, so a phone number alone is not
-- enough: sms_opt_in must be true. Clients set it themselves in portal
-- settings; admin can set it for someone who agreed another way. The first
-- time it is switched on, sms_opt_in_at records when — that is the consent
-- record carriers ask for.

-- ---------------------------------------------------------- contact fields
alter table public.portal_clients
  add column if not exists phone         text,
  add column if not exists sms_opt_in    boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz;

-- Portal numbers are normalised to E.164 before they are saved.
alter table public.portal_clients
  drop constraint if exists portal_clients_phone_e164;
alter table public.portal_clients
  add constraint portal_clients_phone_e164
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

-- proposal_clients.phone predates this and may hold free text, so it is not
-- constrained; it is normalised when a text is sent.
alter table public.proposal_clients
  add column if not exists sms_opt_in    boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz;

create or replace function public.stamp_sms_opt_in()
returns trigger
language plpgsql
as $$
begin
  if new.sms_opt_in and (tg_op = 'INSERT' or not coalesce(old.sms_opt_in, false)) then
    new.sms_opt_in_at := now();
  end if;
  return new;
end $$;

drop trigger if exists portal_clients_stamp_sms_opt_in on public.portal_clients;
create trigger portal_clients_stamp_sms_opt_in
  before insert or update of sms_opt_in on public.portal_clients
  for each row execute function public.stamp_sms_opt_in();

drop trigger if exists proposal_clients_stamp_sms_opt_in on public.proposal_clients;
create trigger proposal_clients_stamp_sms_opt_in
  before insert or update of sms_opt_in on public.proposal_clients
  for each row execute function public.stamp_sms_opt_in();

-- ---------------------------------------------------------- profile writes
-- The policy "clients can manage own profile" (001) is FOR ALL, so a signed-in
-- client could update any column of their own row — including `role`, which
-- /api/portal/admin trusts to decide who is an admin. Now that clients edit
-- their phone and text consent from the browser, narrow what they can write
-- to exactly the fields the settings page needs. The service role (all
-- server routes) is unaffected.
revoke insert, update, delete on public.portal_clients from anon, authenticated;
grant update (full_name, company_name, initials, phone, sms_opt_in)
  on public.portal_clients to authenticated;

-- ---------------------------------------------------------- reminder log
create table if not exists public.client_reminders (
  id                 uuid primary key default gen_random_uuid(),
  -- 'invoice' | 'portal_proposal' | 'proposal' | 'onboarding' | 'custom'
  target_type        text not null,
  target_id          uuid,
  portal_client_id   uuid references public.portal_clients(id) on delete cascade,
  proposal_client_id uuid references public.proposal_clients(id) on delete set null,
  subject            text not null,
  note               text,
  -- 'sent' | 'failed' | 'skipped' (not requested or not possible)
  email_status       text not null default 'skipped',
  email_to           text,
  email_error        text,
  sms_status         text not null default 'skipped',
  sms_to             text,
  sms_error          text,
  created_at         timestamptz not null default now()
);

create index if not exists client_reminders_target_idx
  on public.client_reminders (target_type, target_id, created_at desc);
create index if not exists client_reminders_portal_client_idx
  on public.client_reminders (portal_client_id, created_at desc);

-- Same posture as portal_credentials and the proposal tables: RLS on, no
-- policies. Only server routes holding the service role read or write it.
alter table public.client_reminders enable row level security;
