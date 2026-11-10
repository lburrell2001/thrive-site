-- ============================================================
-- PROJECT CHECKLISTS, SOCIAL GROWTH AND COMPLETION REPORTS
-- ============================================================
-- project_tasks: the work on a portal project. When an estimate is accepted
-- (or a proposal signed) its lines become the checklist; Lauren adds her own
-- tasks too. Ticking them sets the project progress the client sees.
--
-- project_social_accounts: for social media projects (portal_projects.kind =
-- social), one row per account in the package, with the starting stats taken
-- when the project opens and the ending stats at the end. metrics is a list of
-- { key, label, unit, start, end } so any stat can be tracked.
--
-- project_reports: each completion report sent, with a snapshot of what it
-- said, so the client can download it again from their portal.
--
-- All admin-only (RLS on, no policies); the portal reads its own reports
-- through a server route. Safe to run more than once.

alter table public.portal_projects
  add column if not exists kind         text,
  add column if not exists completed_at timestamptz;

create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.portal_projects(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  title       text not null,
  description text not null default '',
  position    integer not null default 0,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on public.project_tasks (project_id, position);

create table if not exists public.project_social_accounts (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.portal_projects(id) on delete cascade,
  platform         text not null default '',
  handle           text not null default '',
  metrics          jsonb not null default '[]'::jsonb,
  start_captured_on date,
  end_captured_on   date,
  position         integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists project_social_accounts_project_idx on public.project_social_accounts (project_id, position);

create table if not exists public.project_reports (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  client_id  uuid not null references public.portal_clients(id) on delete cascade,
  sent_to    text,
  data       jsonb not null,
  sent_at    timestamptz not null default now()
);

create index if not exists project_reports_client_idx on public.project_reports (client_id, sent_at desc);

alter table public.project_tasks enable row level security;
alter table public.project_social_accounts enable row level security;
alter table public.project_reports enable row level security;
revoke all on public.project_tasks, public.project_social_accounts, public.project_reports from anon, authenticated;
