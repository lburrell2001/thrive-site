-- ============================================================
-- INQUIRY COMPANY
-- ============================================================
-- The contact form has always asked for a company, but there was nowhere
-- to put it (and, until Sept 2026, the form sent its fields under names the
-- route ignored, so service and message were lost too). Store it, and let
-- it name the CRM contact's company when the contact is new.

alter table public.contact_inquiries
  add column if not exists company text;

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
      insert into public.crm_contacts (name, company, email, source)
      values (coalesce(new.name, ''), nullif(btrim(new.company), ''), lower(btrim(new.email)), 'inquiry')
      returning id into cid;
    else
      update public.crm_contacts
         set company = coalesce(company, nullif(btrim(new.company), ''))
       where id = cid;
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
