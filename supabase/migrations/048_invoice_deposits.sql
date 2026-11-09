-- ============================================================
-- INVOICE DEPOSITS
-- ============================================================
-- An invoice can ask for a deposit first: deposit_cents due by
-- deposit_due_date. The client pays only that; the rest (amount_cents minus
-- the deposit) stays locked (balance_open = false) until Lauren opens it from
-- admin, which also sets the due date of the balance. src/lib/invoiceDeposit.ts
-- holds the rules; Stripe Checkout charges whichever part is due now.
--
-- status stays due until the balance is paid, then paid as before. A
-- paid deposit wins the CRM deal of the invoice, as a paid invoice does.
--
-- Invoices without a deposit are unchanged (balance_open defaults to true).
-- Safe to run more than once.

alter table public.portal_invoices
  add column if not exists deposit_cents      integer,
  add column if not exists deposit_due_date   date,
  add column if not exists deposit_paid_at    timestamptz,
  add column if not exists deposit_session_id text,
  add column if not exists balance_open       boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portal_invoices_deposit_check') then
    alter table public.portal_invoices
      add constraint portal_invoices_deposit_check
      check (deposit_cents is null or (deposit_cents > 0 and deposit_cents < amount_cents));
  end if;
end $$;

-- A paid deposit wins the deal, like a paid invoice.
create or replace function public.crm_portal_invoice_deposit_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deposit_paid_at is null or old.deposit_paid_at is not null or new.crm_deal_id is null then return null; end if;
  update public.crm_deals
     set stage = 'won',
         value_cents = coalesce(value_cents, nullif(new.amount_cents, 0))
   where id = new.crm_deal_id and stage <> 'won';
  return null;
end $$;

drop trigger if exists portal_invoices_crm_deposit_paid on public.portal_invoices;
create trigger portal_invoices_crm_deposit_paid
  after update of deposit_paid_at on public.portal_invoices
  for each row execute function public.crm_portal_invoice_deposit_paid();

-- ============================================================
-- DEAL PROJECTS
-- ============================================================
-- A new deal on the pipeline can add its contact to Clients with a portal
-- project named after the deal (create_deal_project, called from
-- POST /api/crm/deals/[id]/project). Adding client work normally moves an
-- early deal up to Proposal; a project made this way leaves the stage alone,
-- because a new lead with a project has not been sent anything yet.

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

  if coalesce(current_setting('thrive.keep_stage', true), '') <> 'on' then
    update public.crm_deals
       set stage = 'proposal', updated_at = now()
     where id = did and stage in ('lead', 'contacted');
  end if;
  update public.crm_deals set updated_at = now() where id = did and stage = 'proposal';
  return did;
end $$;

create or replace function public.create_deal_project(p_client uuid, p_deal uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  perform set_config('thrive.keep_stage', 'on', true);
  insert into public.portal_projects (client_id, name, status, progress, crm_deal_id)
  values (p_client, p_name, 'kickoff', 0, p_deal)
  returning id into pid;
  perform set_config('thrive.keep_stage', 'off', true);
  return pid;
end $$;

revoke all on function public.create_deal_project(uuid, uuid, text) from public, anon, authenticated;
