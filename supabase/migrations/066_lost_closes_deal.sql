-- 066: moving a deal to Lost closes it.
--
-- Lost (dragged on the pipeline, changed in the panel, or "→ Prospect" in bulk)
-- stamps closed_at with closed_reason 'lost', and the deal's portal projects
-- are archived with status 'lost' (shown as "Lost" in admin and the portal)
-- and their recurring invoices cancelled. Moving the deal off Lost (by hand,
-- or a payment winning it) reopens it and brings those projects back.
-- Done in the database so every way a deal reaches Lost does it. Re-runnable.

-- Before: the deal's own columns.
create or replace function public.crm_deal_lost_close()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stage = 'lost' and (tg_op = 'INSERT' or old.stage is distinct from 'lost') then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_reason := 'lost';
  elsif tg_op = 'UPDATE' and old.stage = 'lost' and new.stage <> 'lost' and old.closed_reason = 'lost' then
    new.closed_at := null;
    new.closed_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists crm_deals_lost_close on public.crm_deals;
create trigger crm_deals_lost_close
  before insert or update of stage on public.crm_deals
  for each row execute function public.crm_deal_lost_close();

-- After: the deal's portal projects and their recurring invoices.
create or replace function public.crm_deal_lost_projects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr record;
begin
  if new.stage = 'lost' and old.stage is distinct from 'lost' then
    for pr in
      update public.portal_projects
         set archived = true, status = 'lost'
       where crm_deal_id = new.id and status <> 'completed'
      returning client_id, name
    loop
      update public.portal_invoice_subscriptions
         set status = 'cancelled'
       where client_id = pr.client_id and project_name = pr.name and status in ('active', 'paused');
    end loop;
  elsif old.stage = 'lost' and new.stage <> 'lost' then
    update public.portal_projects
       set archived = false, status = 'kickoff'
     where crm_deal_id = new.id and status = 'lost';
  end if;
  return null;
end $$;

revoke all on function public.crm_deal_lost_projects() from public, anon, authenticated;

drop trigger if exists crm_deals_lost_projects on public.crm_deals;
create trigger crm_deals_lost_projects
  after update of stage on public.crm_deals
  for each row execute function public.crm_deal_lost_projects();

-- Backfill: deals already Lost.
update public.crm_deals
   set closed_at = coalesce(closed_at, stage_changed_at, now()), closed_reason = 'lost'
 where stage = 'lost' and (closed_at is null or closed_reason is distinct from 'lost');

update public.portal_projects pp
   set archived = true, status = 'lost'
  from public.crm_deals d
 where d.id = pp.crm_deal_id and d.stage = 'lost' and pp.status not in ('completed', 'lost');
