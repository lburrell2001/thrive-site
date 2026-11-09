-- ============================================================
-- ESTIMATES ON DEALS
-- ============================================================
-- An estimate belongs to a deal, like a proposal or an invoice:
--   the contact deal with the same name as the estimate project (picked
--   from the Project dropdown), else their open deal, else a new lead named
--   after the project. Estimates for a typed name with no contact have none.
-- Sent moves the deal up to Proposal sent; accepted wins it. Stages never
-- move backward on their own; a declined estimate leaves the deal alone.
--
-- The contact is the estimate CRM contact, or the contact of its portal
-- client. Existing estimates are linked to a deal (none are created for them).
-- Safe to run more than once.

alter table public.estimates
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete set null;

create index if not exists estimates_crm_deal_idx on public.estimates (crm_deal_id);

-- The contact behind an estimate, if any.
create or replace function public.crm_estimate_contact(p_contact uuid, p_portal uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_contact is not null then return p_contact; end if;
  if p_portal is not null then return public.crm_contact_for_portal(p_portal); end if;
  return null;
end $$;

-- The deal with this name, else the open deal (no new deal).
create or replace function public.crm_estimate_existing_deal(p_contact uuid, p_title text)
returns uuid
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select id from public.crm_deals
      where contact_id = p_contact and stage <> 'lost'
        and nullif(btrim(p_title), '') is not null
        and lower(btrim(title)) = lower(btrim(p_title))
      order by updated_at desc limit 1),
    public.crm_open_deal(p_contact)
  )
$$;

create or replace function public.crm_estimate_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  did uuid;
begin
  if new.crm_deal_id is not null then return new; end if;
  cid := public.crm_estimate_contact(new.crm_contact_id, new.portal_client_id);
  if cid is null then return new; end if;

  did := public.crm_estimate_existing_deal(cid, new.title);
  if did is null then
    insert into public.crm_deals (contact_id, title, source)
    values (cid, coalesce(nullif(btrim(new.title), ''), 'Estimate ' || new.estimate_number), 'estimate')
    returning id into did;
  end if;
  new.crm_deal_id := did;
  return new;
end $$;

drop trigger if exists estimates_crm_deal on public.estimates;
create trigger estimates_crm_deal
  before insert on public.estimates
  for each row execute function public.crm_estimate_deal();

-- Sent: up to Proposal sent. Accepted: won.
create or replace function public.crm_follow_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status or new.crm_deal_id is null then return null; end if;

  if new.status = 'sent' then
    update public.crm_deals
       set stage = 'proposal',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage in ('lead', 'contacted');
  elsif new.status = 'accepted' then
    update public.crm_deals
       set stage = 'won',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage <> 'won';
  end if;
  return null;
end $$;

drop trigger if exists estimates_crm_follow on public.estimates;
create trigger estimates_crm_follow
  after update of status on public.estimates
  for each row execute function public.crm_follow_estimate();

revoke execute on function public.crm_estimate_contact(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.crm_estimate_existing_deal(uuid, text) from public, anon, authenticated;

-- Existing estimates: link them, without opening deals or moving stages.
update public.estimates e
   set crm_deal_id = public.crm_estimate_existing_deal(
         public.crm_estimate_contact(e.crm_contact_id, e.portal_client_id), e.title)
 where e.crm_deal_id is null
   and (e.crm_contact_id is not null or e.portal_client_id is not null);
