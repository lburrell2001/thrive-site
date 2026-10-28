-- 038: close the holes found in the October 2026 security audit.
--
-- Every write the app makes to these tables goes through the service role,
-- which bypasses RLS, so nothing here takes access away from the app. What it
-- takes away is access through the public anon key (shipped to every browser)
-- and from signed-in portal clients beyond their own rows.
--
-- Safe to run more than once.

-- 1. portal_invoices: migration 001 added a policy with no `to` clause and
--    `using (true)`, which applied to everyone — anyone with the anon key could
--    read, insert, edit (e.g. mark paid) and delete every invoice. The service
--    role never needed it. Clients keep "clients can view own invoices".
drop policy if exists "service role full access to invoices" on portal_invoices;
revoke insert, update, delete on portal_invoices from anon, authenticated;

-- 2. SECURITY DEFINER helpers from 036 were callable over RPC by anyone.
--    They are only meant to run inside the 036 triggers.
revoke execute on function public.crm_contact_for_portal(uuid) from public, anon, authenticated;
revoke execute on function public.crm_deal_for_portal_work(uuid, uuid, text) from public, anon, authenticated;

-- 3. service_featured_projects: any signed-in portal client could rewrite the
--    public site's featured projects. Admin edits go through the service role.
drop policy if exists "Authenticated can manage service featured projects" on service_featured_projects;
revoke insert, update, delete on service_featured_projects from anon, authenticated;
drop policy if exists "Authenticated can read service featured projects" on service_featured_projects;
create policy "Authenticated can read service featured projects"
  on service_featured_projects for select to authenticated using (true);

-- 4. portal_proposals: clients could update any column of their own proposals
--    (status, signed_file_url, file_url…). Signing goes through
--    /api/portal/submit-proposal with the service role, so clients only read.
drop policy if exists "clients can update own proposals" on portal_proposals;
revoke insert, update, delete on portal_proposals from anon, authenticated;

-- 5. Tables created outside the migrations. Make sure RLS is on and only the
--    access the public site needs is left.
do $$
declare pol record;
begin
  -- admin_config holds the admin passcode: no browser access at all.
  if to_regclass('public.admin_config') is not null then
    execute 'alter table public.admin_config enable row level security';
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'admin_config' loop
      execute format('drop policy %I on public.admin_config', pol.policyname);
    end loop;
    execute 'revoke all on public.admin_config from anon, authenticated';
  end if;

  -- contact_inquiries: the contact form and bookings insert with the service
  -- role, so the browser needs nothing.
  if to_regclass('public.contact_inquiries') is not null then
    execute 'alter table public.contact_inquiries enable row level security';
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'contact_inquiries' loop
      execute format('drop policy %I on public.contact_inquiries', pol.policyname);
    end loop;
    execute 'revoke all on public.contact_inquiries from anon, authenticated';
  end if;

  -- projects: the public site reads them with the anon key; only admin
  -- (service role) writes.
  if to_regclass('public.projects') is not null then
    execute 'alter table public.projects enable row level security';
    for pol in select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'projects' loop
      if pol.cmd <> 'SELECT' then
        execute format('drop policy %I on public.projects', pol.policyname);
      end if;
    end loop;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT') then
      execute 'create policy "Public can read projects" on public.projects for select to anon, authenticated using (true)';
    end if;
    execute 'revoke insert, update, delete on public.projects from anon, authenticated';
  end if;
end $$;

-- 6. Rate limits (src/lib/rateLimit.ts): wrong admin passcodes (8 per 15
--    minutes locks that address out), the contact form, bookings, portal
--    sign-in codes and newsletter sign-ups. client_key is an HMAC of the IP,
--    never the IP itself; rows older than 30 days are deleted as it goes.
create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  client_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup on rate_limit_hits (bucket, client_key, created_at);
alter table rate_limit_hits enable row level security;
revoke all on rate_limit_hits from anon, authenticated;
