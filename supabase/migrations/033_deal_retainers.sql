-- ============================================================
-- RETAINER DEALS — a monthly price for a number of months
-- ============================================================
-- A deal with monthly_cents set is a retainer: monthly_cents for
-- term_months, starting starts_on (or, if that's blank, the day it was
-- won). Its value_cents is kept as the whole contract (monthly × months)
-- by the trigger below, so every total that reads value_cents — won this
-- month, the pipeline, analytics, campaigns — counts a retainer at its
-- full worth without knowing about retainers.

alter table public.crm_deals
  add column if not exists monthly_cents int check (monthly_cents >= 0),
  add column if not exists term_months   int check (term_months between 1 and 120),
  add column if not exists starts_on     date;

create or replace function public.crm_deals_retainer_value()
returns trigger
language plpgsql
as $$
begin
  if new.monthly_cents is not null and new.term_months is not null then
    new.value_cents := new.monthly_cents * new.term_months;
  end if;
  if new.monthly_cents is null then
    new.term_months := null;
    new.starts_on := null;
  end if;
  return new;
end $$;

drop trigger if exists crm_deals_retainer_value on public.crm_deals;
create trigger crm_deals_retainer_value
  before insert or update of monthly_cents, term_months, value_cents on public.crm_deals
  for each row execute function public.crm_deals_retainer_value();
