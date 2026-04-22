-- ============================================================
-- PROPOSALS TABLE
-- ============================================================

create table if not exists portal_proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  name text not null,
  file_url text not null,
  storage_path text not null default '',
  signed_file_url text,
  signed_storage_path text,
  status text not null default 'pending', -- pending | signed
  created_at timestamptz not null default now()
);

alter table portal_proposals enable row level security;

create policy "clients can view own proposals"
  on portal_proposals for select using (auth.uid() = client_id);

create policy "clients can update own proposals"
  on portal_proposals for update using (auth.uid() = client_id);

-- ============================================================
-- ADD project_name TO portal_activity
-- ============================================================

alter table portal_activity
  add column if not exists project_name text;
