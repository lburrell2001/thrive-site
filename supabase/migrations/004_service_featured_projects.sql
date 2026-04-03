create table if not exists service_featured_projects (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  project_slug text not null,
  display_order integer not null default 0,
  created_at timestamptz default now(),
  unique(service_slug, project_slug)
);

alter table service_featured_projects enable row level security;

create policy "Public can read service featured projects"
  on service_featured_projects for select
  to anon using (true);

create policy "Authenticated can manage service featured projects"
  on service_featured_projects for all
  to authenticated using (true);
