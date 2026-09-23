-- ============================================================
-- CRM — one contact per person, whichever door they came in by
-- ============================================================
-- A person can reach Thrive three ways, each with its own table:
--   contact_inquiries  the website contact form (a lead)
--   proposal_clients   someone a proposal was addressed to
--   portal_clients     someone with a portal login (a client)
--
-- crm_contacts sits above all three. Each source row points at (or is
-- pointed at by) one contact, matched on email, so the same person who
-- filled in the form, got a proposal and then a portal login is one card
-- on the pipeline, not three.
--
-- Triggers below keep the links current no matter which route writes the
-- source row, and move a contact along the pipeline when a proposal is
-- sent or signed. Stages only move forward automatically; Lauren can move
-- them anywhere by hand.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crm_stage') then
    create type crm_stage as enum ('lead', 'contacted', 'proposal', 'won', 'lost');
  end if;
end $$;

create table if not exists public.crm_contacts (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default '',
  company           text,
  email             text,
  phone             text,
  stage             crm_stage not null default 'lead',
  stage_changed_at  timestamptz not null default now(),
  -- Estimated or agreed deal value. Filled from the first proposal sent if
  -- left empty.
  value_cents       integer check (value_cents is null or value_cents >= 0),
  -- 'inquiry' | 'proposal' | 'portal' | 'manual' | 'referral' | free text
  source            text not null default 'manual',
  tags              text[] not null default '{}',
  lost_reason       text,
  portal_client_id  uuid unique references public.portal_clients(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists crm_contacts_email_idx on public.crm_contacts (lower(email));
create index if not exists crm_contacts_stage_idx on public.crm_contacts (stage, stage_changed_at desc);

-- Many inquiries or proposal recipients can belong to one contact.
alter table public.contact_inquiries
  add column if not exists crm_contact_id uuid references public.crm_contacts(id) on delete set null;
alter table public.proposal_clients
  add column if not exists crm_contact_id uuid references public.crm_contacts(id) on delete set null;

create index if not exists contact_inquiries_crm_contact_idx on public.contact_inquiries (crm_contact_id);
create index if not exists proposal_clients_crm_contact_idx on public.proposal_clients (crm_contact_id);

-- Notes Lauren writes, calls and meetings she logs, and stage changes.
-- Emails, texts, proposals and invoices are not copied here — the timeline
-- reads them from their own tables.
create table if not exists public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  -- 'note' | 'call' | 'meeting' | 'email' | 'stage'
  kind        text not null default 'note',
  body        text not null default '',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, created_at desc);

create table if not exists public.crm_tasks (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  title         text not null,
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists crm_tasks_open_idx on public.crm_tasks (contact_id, due_date) where completed_at is null;

-- ============================================================
-- STAGE HISTORY
-- ============================================================
create or replace function public.crm_contacts_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage <> 'lost' then new.lost_reason := null; end if;
  end if;
  return new;
end $$;

drop trigger if exists crm_contacts_touch on public.crm_contacts;
create trigger crm_contacts_touch
  before update on public.crm_contacts
  for each row execute function public.crm_contacts_touch();

create or replace function public.crm_log_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.crm_activities (contact_id, kind, body, metadata)
    values (new.id, 'stage', coalesce(new.lost_reason, ''),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end $$;

drop trigger if exists crm_contacts_stage_log on public.crm_contacts;
create trigger crm_contacts_stage_log
  after update of stage on public.crm_contacts
  for each row execute function public.crm_log_stage_change();

-- ============================================================
-- LINKING SOURCE ROWS TO CONTACTS
-- ============================================================
create or replace function public.crm_contact_by_email(p_email text)
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.crm_contacts
   where p_email is not null and btrim(p_email) <> ''
     and lower(email) = lower(btrim(p_email))
   order by created_at
   limit 1
$$;

-- Website inquiry: attach to the person if we know them, otherwise a new
-- lead. Someone we lost who writes in again is a lead again.
create or replace function public.crm_link_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.crm_contact_id is not null then return new; end if;

  cid := public.crm_contact_by_email(new.email);
  if cid is null then
    insert into public.crm_contacts (name, email, source, stage)
    values (coalesce(new.name, ''), lower(btrim(new.email)), 'inquiry', 'lead')
    returning id into cid;
  else
    update public.crm_contacts set stage = 'lead' where id = cid and stage = 'lost';
  end if;

  new.crm_contact_id := cid;
  return new;
end $$;

drop trigger if exists contact_inquiries_crm_link on public.contact_inquiries;
create trigger contact_inquiries_crm_link
  before insert on public.contact_inquiries
  for each row execute function public.crm_link_inquiry();

-- Proposal recipient: match on their portal login first, then email.
create or replace function public.crm_link_proposal_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.crm_contact_id is not null then return new; end if;

  if new.portal_client_id is not null then
    select id into cid from public.crm_contacts where portal_client_id = new.portal_client_id;
  end if;
  if cid is null then
    cid := public.crm_contact_by_email(new.email);
  end if;
  if cid is null then
    insert into public.crm_contacts (name, company, email, phone, source, stage)
    values (new.name, new.company, lower(nullif(btrim(new.email), '')), new.phone, 'proposal', 'lead')
    returning id into cid;
  end if;

  new.crm_contact_id := cid;
  return new;
end $$;

drop trigger if exists proposal_clients_crm_link on public.proposal_clients;
create trigger proposal_clients_crm_link
  before insert on public.proposal_clients
  for each row execute function public.crm_link_proposal_client();

-- Portal login: that person is now a client. Only role 'client' rows count;
-- admin accounts live in the same table.
create or replace function public.crm_link_portal_client()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cid   uuid;
  mail  text;
begin
  if new.role <> 'client' then return null; end if;
  if exists (select 1 from public.crm_contacts where portal_client_id = new.id) then return null; end if;

  select email into mail from auth.users where id = new.id;
  select id into cid from public.crm_contacts
   where id = public.crm_contact_by_email(mail) and portal_client_id is null;

  if cid is null then
    insert into public.crm_contacts (name, company, email, phone, source, stage, portal_client_id)
    values (new.full_name, nullif(new.company_name, ''), lower(mail), new.phone, 'portal', 'won', new.id);
  else
    update public.crm_contacts
       set portal_client_id = new.id,
           stage = 'won',
           company = coalesce(company, nullif(new.company_name, '')),
           phone = coalesce(phone, new.phone)
     where id = cid;
  end if;
  return null;
end $$;

drop trigger if exists portal_clients_crm_link on public.portal_clients;
create trigger portal_clients_crm_link
  after insert on public.portal_clients
  for each row execute function public.crm_link_portal_client();

-- ============================================================
-- PROPOSALS MOVE THE PIPELINE
-- ============================================================
-- Sent or viewed: an early-stage contact moves to 'proposal', and picks up
-- the proposal total as its value if it had none. Signed: won. A decline
-- does not mark the contact lost — the usual next step is a revised
-- proposal — it just shows on the timeline.
create or replace function public.crm_follow_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.status is not distinct from old.status or new.client_id is null then return null; end if;
  select crm_contact_id into cid from public.proposal_clients where id = new.client_id;
  if cid is null then return null; end if;

  if new.status in ('sent', 'viewed') then
    update public.crm_contacts
       set stage = 'proposal',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = cid and stage in ('lead', 'contacted');
  elsif new.status = 'signed' then
    update public.crm_contacts
       set stage = 'won',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = cid and stage <> 'won';
  end if;
  return null;
end $$;

drop trigger if exists proposals_crm_follow on public.proposals;
create trigger proposals_crm_follow
  after update of status on public.proposals
  for each row execute function public.crm_follow_proposal();

-- ============================================================
-- BACKFILL — portal clients, then proposal recipients, then inquiries,
-- so the most-established record names the contact. The stage triggers
-- are off while it runs: these are past states, not events to log.
-- ============================================================
alter table public.crm_contacts disable trigger crm_contacts_touch;
alter table public.crm_contacts disable trigger crm_contacts_stage_log;

insert into public.crm_contacts (name, company, email, phone, source, stage, portal_client_id, created_at)
select pc.full_name, nullif(pc.company_name, ''), lower(u.email), pc.phone, 'portal', 'won', pc.id, pc.created_at
  from public.portal_clients pc
  join auth.users u on u.id = pc.id
 where pc.role = 'client'
   and not exists (select 1 from public.crm_contacts c where c.portal_client_id = pc.id);

-- Recipients: link through their portal login, else by email, else new.
update public.proposal_clients r
   set crm_contact_id = c.id
  from public.crm_contacts c
 where r.crm_contact_id is null and r.portal_client_id is not null
   and c.portal_client_id = r.portal_client_id;

update public.proposal_clients r
   set crm_contact_id = public.crm_contact_by_email(r.email)
 where r.crm_contact_id is null and public.crm_contact_by_email(r.email) is not null;

do $$
declare
  r record;
  cid uuid;
begin
  for r in select * from public.proposal_clients where crm_contact_id is null order by created_at loop
    cid := public.crm_contact_by_email(r.email);
    if cid is null then
      insert into public.crm_contacts (name, company, email, phone, source, stage, created_at)
      values (r.name, r.company, lower(nullif(btrim(r.email), '')), r.phone, 'proposal', 'lead', r.created_at)
      returning id into cid;
    end if;
    update public.proposal_clients set crm_contact_id = cid where id = r.id;
  end loop;

  for r in select * from public.contact_inquiries where crm_contact_id is null order by created_at loop
    cid := public.crm_contact_by_email(r.email);
    if cid is null then
      insert into public.crm_contacts (name, email, source, stage, created_at)
      values (coalesce(r.name, ''), lower(btrim(r.email)), 'inquiry', 'lead', r.created_at)
      returning id into cid;
    end if;
    update public.contact_inquiries set crm_contact_id = cid where id = r.id;
  end loop;
end $$;

-- Stage from proposal history for contacts not already won through the portal.
update public.crm_contacts c
   set stage = 'won',
       value_cents = coalesce(c.value_cents, p.total)
  from (select r.crm_contact_id, max(p.total_cents) filter (where p.status = 'signed') as total
          from public.proposals p join public.proposal_clients r on r.id = p.client_id
         where p.status = 'signed'
         group by r.crm_contact_id) p
 where p.crm_contact_id = c.id and c.stage <> 'won';

update public.crm_contacts c
   set stage = 'proposal',
       value_cents = coalesce(c.value_cents, p.total)
  from (select r.crm_contact_id, max(p.total_cents) as total
          from public.proposals p join public.proposal_clients r on r.id = p.client_id
         where p.status in ('sent', 'viewed')
         group by r.crm_contact_id) p
 where p.crm_contact_id = c.id and c.stage = 'lead';

alter table public.crm_contacts enable trigger crm_contacts_touch;
alter table public.crm_contacts enable trigger crm_contacts_stage_log;

-- ============================================================
-- ROW LEVEL SECURITY — same posture as the proposal tables: on, no
-- policies. Only server routes holding the service role reach these.
-- ============================================================
alter table public.crm_contacts   enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks      enable row level security;
