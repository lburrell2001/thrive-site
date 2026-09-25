-- ============================================================
-- NEWSLETTER BLOCKS — designed, marketing-style newsletters
-- ============================================================
-- A newsletter can now be a stack of blocks (images designed in Canva or
-- Adobe Express, headings, text, buttons, two-column sections, social
-- links) with its own colors and fonts, instead of one markdown body.
-- Newsletters with blocks render from them; older ones still render from
-- `body`.
--
-- Templates save a layout and design to start the next newsletter from.
-- Images are uploaded to the public course-media bucket under newsletters/.

alter table public.newsletters
  add column if not exists blocks jsonb not null default '[]'::jsonb,
  add column if not exists design jsonb not null default '{}'::jsonb;

create table if not exists public.newsletter_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  blocks      jsonb not null default '[]'::jsonb,
  design      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.newsletter_templates enable row level security;
