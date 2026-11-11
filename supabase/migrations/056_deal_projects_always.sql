-- 056: a deal at Quote sent or Won always has a project in Clients.
--
-- Whenever a deal reaches Quote sent (stage 'proposal') or Won and is not
-- closed, and its contact has a portal login, the deal gets a portal project
-- named after it (if it has none). It fires on every route there: dragging on
-- the pipeline, an estimate or proposal being sent, "Create portal login"
-- (which moves the open deal to Quote sent), and a login being linked to a
-- contact whose deals are already there. A project of the same name with no
-- deal is attached instead of making a second one. Contacts without a login
-- get their projects the moment a login is made.
--
-- Backfills the deals missing one today. Safe to run more than once.
-- (No apostrophes in this file: the SQL editor reads them as quotes.)

create or replace function public.crm_ensure_deal_project(p_deal uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  client uuid;
  pid uuid;
begin
  select id, contact_id, title, stage, closed_at into d from public.crm_deals where id = p_deal;
  if d.id is null or d.stage not in ('proposal', 'won') or d.closed_at is not null then return null; end if;
  select portal_client_id into client from public.crm_contacts where id = d.contact_id;
  if client is null then return null; end if;

  select id into pid from public.portal_projects where crm_deal_id = d.id limit 1;
  if pid is not null then return pid; end if;

  -- A project already made for this work under the same name: file it under the deal.
  select id into pid from public.portal_projects
   where client_id = client and crm_deal_id is null and lower(btrim(name)) = lower(btrim(coalesce(d.title, '')))
   limit 1;
  if pid is not null then
    update public.portal_projects set crm_deal_id = d.id where id = pid;
    return pid;
  end if;

  perform set_config('thrive.keep_stage', 'on', true);
  insert into public.portal_projects (client_id, name, status, progress, crm_deal_id)
  values (client, coalesce(nullif(btrim(d.title), ''), 'Client work'), 'kickoff', 0, d.id)
  returning id into pid;
  perform set_config('thrive.keep_stage', 'off', true);
  return pid;
end $$;

revoke all on function public.crm_ensure_deal_project(uuid) from public, anon, authenticated;

-- A deal reaching Quote sent or Won (or reopened there).
create or replace function public.crm_deal_project_on_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage in ('proposal', 'won') and new.closed_at is null
     and (tg_op = 'INSERT' or new.stage is distinct from old.stage or old.closed_at is not null) then
    perform public.crm_ensure_deal_project(new.id);
  end if;
  return null;
end $$;

drop trigger if exists crm_deals_ensure_project on public.crm_deals;
create trigger crm_deals_ensure_project
  after insert or update of stage, closed_at on public.crm_deals
  for each row execute function public.crm_deal_project_on_stage();

-- A contact getting a portal login: their deals already at Quote sent or Won get projects.
create or replace function public.crm_contact_projects_on_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid;
begin
  if new.portal_client_id is not null and new.portal_client_id is distinct from old.portal_client_id then
    for did in select id from public.crm_deals where contact_id = new.id and stage in ('proposal', 'won') and closed_at is null loop
      perform public.crm_ensure_deal_project(did);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists crm_contacts_projects_on_login on public.crm_contacts;
create trigger crm_contacts_projects_on_login
  after update of portal_client_id on public.crm_contacts
  for each row execute function public.crm_contact_projects_on_login();

-- Backfill: open deals at Quote sent or Won with a login and no project.
select public.crm_ensure_deal_project(d.id)
  from public.crm_deals d
  join public.crm_contacts c on c.id = d.contact_id
 where d.stage in ('proposal', 'won') and d.closed_at is null and c.portal_client_id is not null
   and not exists (select 1 from public.portal_projects p where p.crm_deal_id = d.id);
