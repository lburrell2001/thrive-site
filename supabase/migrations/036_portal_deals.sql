-- ============================================================
-- CLIENTS TAB → CRM DEALS
-- ============================================================
-- What Lauren adds on a client in the Clients tab now drives that client's
-- deal in the CRM:
--
--   project / uploaded proposal / invoice added → joins the client's open
--     deal (or opens one) and moves it to 'proposal' (Proposal sent)
--   invoice paid                                → that deal is won
--
-- A portal login on its own no longer wins the deal — adding someone in
-- Clients usually happens before they have paid. Stages still never move
-- backward on their own: 'proposal' only replaces lead/contacted.
--
-- Safe to run more than once.

alter table public.portal_projects
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;
alter table public.portal_proposals
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;
alter table public.portal_invoices
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;

create index if not exists portal_projects_crm_deal_idx on public.portal_projects (crm_deal_id);
create index if not exists portal_proposals_crm_deal_idx on public.portal_proposals (crm_deal_id);
create index if not exists portal_invoices_crm_deal_idx on public.portal_invoices (crm_deal_id);

-- ------------------------------------------------------------
-- The CRM contact for a portal client, created if missing.
-- ------------------------------------------------------------
create or replace function public.crm_contact_for_portal(p_client uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cid  uuid;
  mail text;
  pc   record;
begin
  select id into cid from public.crm_contacts where portal_client_id = p_client;
  if cid is not null then return cid; end if;

  select * into pc from public.portal_clients where id = p_client;
  if not found or pc.role <> 'client' then return null; end if;

  select email into mail from auth.users where id = p_client;
  select id into cid from public.crm_contacts
   where id = public.crm_contact_by_email(mail) and portal_client_id is null;

  if cid is null then
    insert into public.crm_contacts (name, company, email, phone, source, portal_client_id)
    values (pc.full_name, nullif(pc.company_name, ''), lower(mail), pc.phone, 'portal', p_client)
    returning id into cid;
  else
    update public.crm_contacts
       set portal_client_id = p_client,
           company = coalesce(company, nullif(pc.company_name, '')),
           phone = coalesce(phone, pc.phone)
     where id = cid;
  end if;
  return cid;
end $$;

-- ------------------------------------------------------------
-- The deal a piece of client work belongs to.
-- An explicit deal wins; then the open deal; otherwise a new one named after
-- the work. The deal is moved up to 'proposal' if it was earlier than that.
-- ------------------------------------------------------------
create or replace function public.crm_deal_for_portal_work(
  p_client uuid,
  p_deal uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  did uuid := p_deal;
begin
  if did is null then
    cid := public.crm_contact_for_portal(p_client);
    if cid is null then return null; end if;
    did := public.crm_open_deal(cid);
    if did is null then
      insert into public.crm_deals (contact_id, title, stage, source)
      values (cid, coalesce(nullif(btrim(p_title), ''), 'Client work'), 'proposal', 'portal')
      returning id into did;
      return did;
    end if;
  end if;

  update public.crm_deals
     set stage = 'proposal', updated_at = now()
   where id = did and stage in ('lead', 'contacted');
  update public.crm_deals set updated_at = now() where id = did and stage = 'proposal';
  return did;
end $$;

-- ------------------------------------------------------------
-- Projects
-- ------------------------------------------------------------
create or replace function public.crm_portal_project_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.crm_deal_id := public.crm_deal_for_portal_work(new.client_id, new.crm_deal_id, new.name);
  return new;
end $$;

drop trigger if exists portal_projects_crm_deal on public.portal_projects;
create trigger portal_projects_crm_deal
  before insert on public.portal_projects
  for each row execute function public.crm_portal_project_deal();

-- ------------------------------------------------------------
-- Uploaded proposals: the project's deal if it has one.
-- ------------------------------------------------------------
create or replace function public.crm_portal_proposal_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid := new.crm_deal_id;
begin
  if did is null and new.project_id is not null then
    select crm_deal_id into did from public.portal_projects where id = new.project_id;
  end if;
  new.crm_deal_id := public.crm_deal_for_portal_work(new.client_id, did, new.name);
  return new;
end $$;

drop trigger if exists portal_proposals_crm_deal on public.portal_proposals;
create trigger portal_proposals_crm_deal
  before insert on public.portal_proposals
  for each row execute function public.crm_portal_proposal_deal();

-- ------------------------------------------------------------
-- Invoices: the deal of the project with the same name, if there is one.
-- An invoice on a won deal (a retainer month, the final payment) stays on it.
-- ------------------------------------------------------------
create or replace function public.crm_portal_invoice_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid := new.crm_deal_id;
  cid uuid;
begin
  if did is null then
    select crm_deal_id into did from public.portal_projects
     where client_id = new.client_id and crm_deal_id is not null
       and lower(btrim(name)) = lower(btrim(new.project_name))
     order by created_at desc limit 1;
  end if;

  if did is null then
    cid := public.crm_contact_for_portal(new.client_id);
    if cid is not null and public.crm_open_deal(cid) is null then
      -- No open deal: bill against the latest won one rather than open a
      -- new deal for every retainer month.
      select id into did from public.crm_deals
       where contact_id = cid and stage = 'won'
       order by updated_at desc limit 1;
    end if;
  end if;

  if did is not null and exists (select 1 from public.crm_deals where id = did and stage = 'won') then
    new.crm_deal_id := did;
  else
    new.crm_deal_id := public.crm_deal_for_portal_work(new.client_id, did, new.project_name);
  end if;

  -- Entered already paid: won straight away (after insert, below).
  return new;
end $$;

drop trigger if exists portal_invoices_crm_deal on public.portal_invoices;
create trigger portal_invoices_crm_deal
  before insert on public.portal_invoices
  for each row execute function public.crm_portal_invoice_deal();

-- Paid → won. Covers Stripe, the admin's "mark paid", and an invoice
-- entered as already paid. The value is filled from the invoice only if the
-- deal has none yet.
create or replace function public.crm_portal_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'paid' or new.crm_deal_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'paid' then return null; end if;

  update public.crm_deals
     set stage = 'won',
         value_cents = coalesce(value_cents, nullif(new.amount_cents, 0))
   where id = new.crm_deal_id and stage <> 'won';
  return null;
end $$;

drop trigger if exists portal_invoices_crm_paid on public.portal_invoices;
create trigger portal_invoices_crm_paid
  after insert or update of status on public.portal_invoices
  for each row execute function public.crm_portal_invoice_paid();

-- ------------------------------------------------------------
-- A portal login links the contact but no longer wins the deal.
-- ------------------------------------------------------------
create or replace function public.crm_link_portal_client()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.role <> 'client' then return null; end if;
  perform public.crm_contact_for_portal(new.id);
  return null;
end $$;

-- ------------------------------------------------------------
-- Backfill: attach existing client work to deals without moving any stage.
-- (Existing states are history, not new events.)
-- ------------------------------------------------------------
do $$
declare
  r   record;
  cid uuid;
  did uuid;
begin
  for r in select id, client_id from public.portal_projects where crm_deal_id is null loop
    cid := public.crm_contact_for_portal(r.client_id);
    if cid is null then continue; end if;
    select id into did from public.crm_deals where contact_id = cid order by updated_at desc limit 1;
    if did is not null then update public.portal_projects set crm_deal_id = did where id = r.id; end if;
  end loop;

  for r in select id, client_id, project_id from public.portal_proposals where crm_deal_id is null loop
    did := null;
    if r.project_id is not null then
      select crm_deal_id into did from public.portal_projects where id = r.project_id;
    end if;
    if did is null then
      cid := public.crm_contact_for_portal(r.client_id);
      if cid is null then continue; end if;
      select id into did from public.crm_deals where contact_id = cid order by updated_at desc limit 1;
    end if;
    if did is not null then update public.portal_proposals set crm_deal_id = did where id = r.id; end if;
  end loop;

  for r in select id, client_id from public.portal_invoices where crm_deal_id is null loop
    cid := public.crm_contact_for_portal(r.client_id);
    if cid is null then continue; end if;
    select id into did from public.crm_deals where contact_id = cid order by updated_at desc limit 1;
    if did is not null then update public.portal_invoices set crm_deal_id = did where id = r.id; end if;
  end loop;
end $$;
