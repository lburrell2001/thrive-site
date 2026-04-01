-- ============================================================
-- PORTAL TABLES
-- ============================================================

-- Client profiles (1:1 with auth.users)
create table if not exists portal_clients (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  company_name text not null default '',
  initials text not null default '',
  role text not null default 'client',
  created_at timestamptz not null default now()
);

-- Projects
create table if not exists portal_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  name text not null,
  status text not null default 'kickoff', -- kickoff | in_progress | review | completed
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  color text not null default '#e40586',
  created_at timestamptz not null default now()
);

-- Design requests
create table if not exists portal_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  title text not null,
  type text not null default 'Brand Design',
  status text not null default 'kickoff', -- kickoff | in_progress | review | completed
  priority text not null default 'normal', -- high | normal | low
  created_at timestamptz not null default now()
);

-- Invoices
create table if not exists portal_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  invoice_number text not null,
  project_name text not null,
  amount_cents int not null,
  invoice_date date not null,
  due_date date not null,
  status text not null default 'due', -- due | paid | overdue
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);

-- Activity feed
create table if not exists portal_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  text text not null,
  dot_color text not null default '#808080',
  created_at timestamptz not null default now()
);

-- Upcoming milestones
create table if not exists portal_milestones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_name text not null,
  title text not null,
  due_date date not null,
  color text not null default '#e40586',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Onboarding steps
create table if not exists portal_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  step_number int not null,
  title text not null,
  description text not null,
  completed boolean not null default false,
  action_label text,
  action_href text,
  created_at timestamptz not null default now(),
  unique (client_id, step_number)
);

-- Files delivered
create table if not exists portal_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  name text not null,
  project_name text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table portal_clients enable row level security;
alter table portal_projects enable row level security;
alter table portal_requests enable row level security;
alter table portal_invoices enable row level security;
alter table portal_activity enable row level security;
alter table portal_milestones enable row level security;
alter table portal_onboarding_steps enable row level security;
alter table portal_files enable row level security;

-- Each client can only read/write their own rows
create policy "clients can manage own profile"
  on portal_clients for all using (auth.uid() = id);

create policy "clients can view own projects"
  on portal_projects for select using (auth.uid() = client_id);

create policy "clients can manage own requests"
  on portal_requests for all using (auth.uid() = client_id);

create policy "clients can view own invoices"
  on portal_invoices for select using (auth.uid() = client_id);

create policy "clients can view own activity"
  on portal_activity for select using (auth.uid() = client_id);

create policy "clients can view own milestones"
  on portal_milestones for select using (auth.uid() = client_id);

create policy "clients can view own onboarding"
  on portal_onboarding_steps for select using (auth.uid() = client_id);

create policy "clients can view own files"
  on portal_files for select using (auth.uid() = client_id);

-- Service role can do everything (for webhook/admin use)
create policy "service role full access to invoices"
  on portal_invoices for all using (true) with check (true);
