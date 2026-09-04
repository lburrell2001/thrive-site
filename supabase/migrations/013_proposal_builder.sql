-- ============================================================
-- PROPOSAL BUILDER — schema, RLS, totals trigger, storage
-- ============================================================
-- Naming note: the recipient table is `proposal_clients`, not `clients`,
-- so it cannot be confused with `portal_clients` (which is 1:1 with
-- auth.users). A proposal recipient does not need a portal login;
-- link one later via portal_client_id when they get an account.

-- ------------------------------------------------------------
-- Recipients
-- ------------------------------------------------------------
create table if not exists public.proposal_clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  company           text,
  email             text,
  phone             text,
  portal_client_id  uuid references public.portal_clients(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Templates
-- ------------------------------------------------------------
create table if not exists public.proposal_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  blocks        jsonb not null default '[]'::jsonb,  -- array of blocks with placeholder content
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Only one template may be the default.
create unique index if not exists proposal_templates_one_default
  on public.proposal_templates (is_default) where is_default;

-- ------------------------------------------------------------
-- Proposals
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type proposal_status as enum ('draft','sent','viewed','signed','declined','expired');
  end if;
end $$;

create table if not exists public.proposals (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,        -- url-safe, e.g. dallas-derby-day-2026
  access_token      text not null unique,        -- random 32-char, required to view
  title             text not null,
  client_id         uuid references public.proposal_clients(id) on delete set null,
  template_id       uuid references public.proposal_templates(id) on delete set null,
  status            proposal_status not null default 'draft',
  proposal_date     date not null default current_date,
  valid_until       date,
  currency          text not null default 'USD',
  total_cents       integer not null default 0,
  deposit_percent   smallint not null default 50
                      check (deposit_percent >= 0 and deposit_percent <= 100),
  theme             jsonb not null default '{}'::jsonb,  -- accent overrides
  sent_at           timestamptz,
  first_viewed_at   timestamptz,
  signed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists proposals_status_idx on public.proposals (status, created_at desc);

-- ------------------------------------------------------------
-- Blocks
-- ------------------------------------------------------------
create table if not exists public.proposal_blocks (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals(id) on delete cascade,
  type          text not null,
  position      integer not null,
  visible       boolean not null default true,
  -- Per-block accent override. Null falls back to proposals.theme.accent.
  accent        text check (accent in ('lime','orange','pink','purple')),
  content       jsonb not null default '{}'::jsonb,
  constraint proposal_blocks_position_unique
    unique (proposal_id, position) deferrable initially deferred
);

create index if not exists proposal_blocks_proposal_position_idx
  on public.proposal_blocks (proposal_id, position);

-- ------------------------------------------------------------
-- Line items
-- ------------------------------------------------------------
create table if not exists public.proposal_line_items (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references public.proposals(id) on delete cascade,
  label             text not null,
  description       text,
  quantity          numeric not null default 1,
  unit_price_cents  integer not null default 0,
  position          integer not null
);

create index if not exists proposal_line_items_proposal_position_idx
  on public.proposal_line_items (proposal_id, position);

-- ------------------------------------------------------------
-- Signatures
-- ------------------------------------------------------------
create table if not exists public.proposal_signatures (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  signer_name     text not null,
  signer_email    text not null,
  signer_title    text,
  typed_name      text not null,       -- typed signature; store exactly as entered
  agreed_terms    boolean not null default false,
  ip_address      inet,
  user_agent      text,
  -- Frozen copy of what was on screen at signing time. A later edit to
  -- proposal_blocks cannot change what this record says was signed.
  blocks_snapshot jsonb not null default '[]'::jsonb,
  content_hash    text,                -- sha256 of the canonical snapshot
  total_cents     integer not null default 0,
  signed_at       timestamptz not null default now()
);

create index if not exists proposal_signatures_proposal_idx
  on public.proposal_signatures (proposal_id, signed_at desc);

-- ------------------------------------------------------------
-- Events
-- ------------------------------------------------------------
create table if not exists public.proposal_events (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals(id) on delete cascade,
  type          text not null,       -- 'viewed' | 'downloaded' | 'signed' | 'declined'
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists proposal_events_proposal_created_idx
  on public.proposal_events (proposal_id, created_at desc);

-- ============================================================
-- TOTALS — recalculated server-side, never trusted from the client
-- ============================================================
create or replace function public.recalc_proposal_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  update public.proposals p
     set total_cents = coalesce((
           select round(sum(li.quantity * li.unit_price_cents))
             from public.proposal_line_items li
            where li.proposal_id = target
         ), 0),
         updated_at = now()
   where p.id = target;
  return null;
end $$;

drop trigger if exists proposal_line_items_total on public.proposal_line_items;
create trigger proposal_line_items_total
  after insert or update or delete on public.proposal_line_items
  for each row execute function public.recalc_proposal_total();

create or replace function public.touch_proposal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists proposals_touch_updated_at on public.proposals;
create trigger proposals_touch_updated_at
  before update on public.proposals
  for each row execute function public.touch_proposal_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS is on with NO policies on every table, which is the same posture as
-- portal_credentials. Neither the anon key nor an authenticated client key
-- can read or write any of these rows.
--
-- Admin access in this codebase is a passcode checked against admin_config
-- inside a server route, NOT a Supabase Auth session — there is no
-- public.is_admin() to write a policy against. So both access paths go
-- through server code holding the service role key, which bypasses RLS:
--   * admin  — passcode verified in the route before any query runs
--   * client — access_token from the URL verified before any query runs
-- Nothing here is reachable from the browser directly.

alter table public.proposal_clients    enable row level security;
alter table public.proposal_templates  enable row level security;
alter table public.proposals           enable row level security;
alter table public.proposal_blocks     enable row level security;
alter table public.proposal_line_items enable row level security;
alter table public.proposal_signatures enable row level security;
alter table public.proposal_events     enable row level security;

-- ============================================================
-- STORAGE — private bucket for proposal imagery
-- Path convention: proposals/{proposal_id}/{block_id}/{filename}
-- Read back through signed URLs minted server-side.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('proposal-media', 'proposal-media', false)
on conflict (id) do nothing;
