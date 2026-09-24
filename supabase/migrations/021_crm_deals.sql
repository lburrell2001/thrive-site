-- ============================================================
-- CRM DEALS — a person can have more than one piece of work
-- ============================================================
-- In 019 the stage lived on the contact, so a past client who wrote in
-- about a new project stayed in Won and the new lead was invisible. Now the
-- contact is the person and a deal is one opportunity with them: its own
-- title, stage, value and history. The board shows deals.
--
-- Existing contacts each become one deal carrying their current stage and
-- value, then those columns leave crm_contacts so there is one source of
-- truth.
--
-- Automatic rules, now per deal:
--   inquiry        → joins the contact's open deal, or opens a new lead
--   new proposal   → joins the contact's open deal, or opens a new lead
--   proposal sent  → that deal moves to 'proposal' (from lead/contacted)
--   proposal signed→ that deal is won, taking the total as its value
--   portal login   → the open deal is won (or a won deal is created)
-- "Open" means lead, contacted or proposal; the most recently active wins.

create table if not exists public.crm_deals (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null references public.crm_contacts(id) on delete cascade,
  title             text not null default 'New project',
  stage             crm_stage not null default 'lead',
  stage_changed_at  timestamptz not null default now(),
  value_cents       integer check (value_cents is null or value_cents >= 0),
  lost_reason       text,
  -- 'inquiry' | 'proposal' | 'portal' | 'manual'
  source            text not null default 'manual',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists crm_deals_contact_idx on public.crm_deals (contact_id, updated_at desc);
create index if not exists crm_deals_stage_idx on public.crm_deals (stage, stage_changed_at desc);

alter table public.proposals
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;
alter table public.contact_inquiries
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;
-- Stage history belongs to a deal; the deal title is also kept in metadata
-- so the entry still reads sensibly if the deal is deleted.
alter table public.crm_activities
  add column if not exists deal_id uuid references public.crm_deals(id) on delete set null;

create index if not exists proposals_crm_deal_idx on public.proposals (crm_deal_id);
create index if not exists contact_inquiries_crm_deal_idx on public.contact_inquiries (crm_deal_id);

alter table public.crm_deals enable row level security;

-- ============================================================
-- DEAL STAGE HISTORY
-- ============================================================
create or replace function public.crm_deals_touch()
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

drop trigger if exists crm_deals_touch on public.crm_deals;
create trigger crm_deals_touch
  before update on public.crm_deals
  for each row execute function public.crm_deals_touch();

create or replace function public.crm_log_deal_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.crm_activities (contact_id, deal_id, kind, body, metadata)
    values (new.contact_id, new.id, 'stage', coalesce(new.lost_reason, ''),
            jsonb_build_object('from', old.stage, 'to', new.stage, 'deal', new.title));
  end if;
  return null;
end $$;

drop trigger if exists crm_deals_stage_log on public.crm_deals;
create trigger crm_deals_stage_log
  after update of stage on public.crm_deals
  for each row execute function public.crm_log_deal_stage();

-- The contact's open deal to attach new activity to, or null.
create or replace function public.crm_open_deal(p_contact uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.crm_deals
   where contact_id = p_contact and stage in ('lead', 'contacted', 'proposal')
   order by updated_at desc
   limit 1
$$;

-- ============================================================
-- BACKFILL — one deal per contact, from its current stage and value.
-- Triggers are off: these are existing states, not new events.
-- ============================================================
alter table public.crm_deals disable trigger crm_deals_touch;
alter table public.crm_deals disable trigger crm_deals_stage_log;

do $$
declare
  c record;
  did uuid;
  deal_title text;
begin
  -- Only runs while the contact-level columns still exist (first run).
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crm_contacts' and column_name = 'stage'
  ) then
    return;
  end if;

  for c in execute 'select id, name, company, stage, stage_changed_at, value_cents, lost_reason, source, created_at from public.crm_contacts' loop
    if exists (select 1 from public.crm_deals where contact_id = c.id) then continue; end if;

    select p.title into deal_title
      from public.proposals p join public.proposal_clients r on r.id = p.client_id
     where r.crm_contact_id = c.id
     order by p.updated_at desc limit 1;
    if deal_title is null then
      select nullif(i.project_type, '') || ' inquiry' into deal_title
        from public.contact_inquiries i where i.crm_contact_id = c.id
       order by i.created_at desc limit 1;
    end if;
    deal_title := coalesce(deal_title, nullif(c.company, ''), 'First project');

    insert into public.crm_deals (contact_id, title, stage, stage_changed_at, value_cents, lost_reason, source, created_at, updated_at)
    values (c.id, deal_title, c.stage, c.stage_changed_at, c.value_cents, c.lost_reason,
            case when c.source in ('inquiry', 'proposal', 'portal') then c.source else 'manual' end,
            c.created_at, c.stage_changed_at)
    returning id into did;

    update public.proposals p set crm_deal_id = did
      from public.proposal_clients r
     where r.id = p.client_id and r.crm_contact_id = c.id and p.crm_deal_id is null;
    update public.contact_inquiries set crm_deal_id = did
     where crm_contact_id = c.id and crm_deal_id is null;
    update public.crm_activities set deal_id = did,
           metadata = metadata || jsonb_build_object('deal', deal_title)
     where contact_id = c.id and kind = 'stage' and deal_id is null;
  end loop;
end $$;

alter table public.crm_deals enable trigger crm_deals_touch;
alter table public.crm_deals enable trigger crm_deals_stage_log;

-- ============================================================
-- THE CONTACT IS NOW JUST THE PERSON
-- ============================================================
drop trigger if exists crm_contacts_stage_log on public.crm_contacts;
drop function if exists public.crm_log_stage_change();

create or replace function public.crm_contacts_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

alter table public.crm_contacts
  drop column if exists stage,
  drop column if exists stage_changed_at,
  drop column if exists value_cents,
  drop column if exists lost_reason;

-- ============================================================
-- LINKING, REWRITTEN FOR DEALS
-- ============================================================
create or replace function public.crm_link_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid := new.crm_contact_id;
  did uuid;
begin
  if cid is null then
    cid := public.crm_contact_by_email(new.email);
    if cid is null then
      insert into public.crm_contacts (name, email, source)
      values (coalesce(new.name, ''), lower(btrim(new.email)), 'inquiry')
      returning id into cid;
    end if;
    new.crm_contact_id := cid;
  end if;

  if new.crm_deal_id is null then
    did := public.crm_open_deal(cid);
    if did is null then
      -- A past client or a lost lead writing in again is new work.
      insert into public.crm_deals (contact_id, title, source)
      values (cid, coalesce(nullif(btrim(new.project_type), '') || ' inquiry', 'Website inquiry'), 'inquiry')
      returning id into did;
    else
      update public.crm_deals set updated_at = now() where id = did;
    end if;
    new.crm_deal_id := did;
  end if;
  return new;
end $$;

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
    insert into public.crm_contacts (name, company, email, phone, source)
    values (new.name, new.company, lower(nullif(btrim(new.email), '')), new.phone, 'proposal')
    returning id into cid;
  end if;

  new.crm_contact_id := cid;
  return new;
end $$;

create or replace function public.crm_link_portal_client()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cid  uuid;
  did  uuid;
  mail text;
begin
  if new.role <> 'client' then return null; end if;
  if exists (select 1 from public.crm_contacts where portal_client_id = new.id) then return null; end if;

  select email into mail from auth.users where id = new.id;
  select id into cid from public.crm_contacts
   where id = public.crm_contact_by_email(mail) and portal_client_id is null;

  if cid is null then
    insert into public.crm_contacts (name, company, email, phone, source, portal_client_id)
    values (new.full_name, nullif(new.company_name, ''), lower(mail), new.phone, 'portal', new.id)
    returning id into cid;
  else
    update public.crm_contacts
       set portal_client_id = new.id,
           company = coalesce(company, nullif(new.company_name, '')),
           phone = coalesce(phone, new.phone)
     where id = cid;
  end if;

  -- A portal login means the work was won.
  did := public.crm_open_deal(cid);
  if did is not null then
    update public.crm_deals set stage = 'won' where id = did;
  elsif not exists (select 1 from public.crm_deals where contact_id = cid) then
    insert into public.crm_deals (contact_id, title, stage, source)
    values (cid, coalesce(nullif(new.company_name, ''), nullif(new.full_name, ''), 'Client work'), 'won', 'portal');
  end if;
  return null;
end $$;

-- A proposal belongs to a deal: the recipient's open deal, or a new lead
-- named after the proposal. Set on create, and when a recipient is first
-- attached to a proposal that had none.
create or replace function public.crm_proposal_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  did uuid;
begin
  if new.crm_deal_id is not null or new.client_id is null then return new; end if;
  select crm_contact_id into cid from public.proposal_clients where id = new.client_id;
  if cid is null then return new; end if;

  did := public.crm_open_deal(cid);
  if did is null then
    insert into public.crm_deals (contact_id, title, source)
    values (cid, new.title, 'proposal')
    returning id into did;
  end if;
  new.crm_deal_id := did;
  return new;
end $$;

drop trigger if exists proposals_crm_deal on public.proposals;
create trigger proposals_crm_deal
  before insert or update of client_id on public.proposals
  for each row execute function public.crm_proposal_deal();

create or replace function public.crm_follow_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status or new.crm_deal_id is null then return null; end if;

  if new.status in ('sent', 'viewed') then
    update public.crm_deals
       set stage = 'proposal',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage in ('lead', 'contacted');
  elsif new.status = 'signed' then
    update public.crm_deals
       set stage = 'won',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage <> 'won';
  end if;
  return null;
end $$;
