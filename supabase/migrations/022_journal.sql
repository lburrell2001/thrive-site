-- ============================================================
-- JOURNAL — articles written in admin, published at /journal
-- ============================================================
-- The site only ranks on Google for what it says. Articles answering the
-- questions clients search for ("how much does branding cost in Dallas")
-- are how a studio site earns search traffic beyond its own name.
--
-- Bodies are markdown, rendered on the site as React elements (no raw
-- HTML). Covers live in the public course-media bucket under journal/.

create table if not exists public.journal_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null,
  -- Shown under the link on Google and on the journal index.
  excerpt       text not null default '',
  body          text not null default '',
  cover_path    text,
  cover_alt     text,
  -- The search this article is written to rank for, e.g.
  -- "how much does a logo cost". Guides the checklist in the editor.
  target_query  text,
  -- The service the article leads into; its call to action and link.
  service_slug  text,
  tags          text[] not null default '{}',
  status        text not null default 'draft' check (status in ('draft', 'published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists journal_posts_published_idx
  on public.journal_posts (published_at desc) where status = 'published';

create or replace function public.journal_posts_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- First publish stamps the date; unpublishing keeps it for when it returns.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists journal_posts_touch on public.journal_posts;
create trigger journal_posts_touch
  before insert or update on public.journal_posts
  for each row execute function public.journal_posts_touch();

-- The public site reads with the anon key, like `projects`: published posts
-- only. Drafts, and every write, go through admin routes with the service
-- role.
alter table public.journal_posts enable row level security;

drop policy if exists "published posts are public" on public.journal_posts;
create policy "published posts are public"
  on public.journal_posts for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());
