-- 068: amending a sent proposal.
--
-- "Amend" in the builder keeps the version the client already has as a
-- snapshot in proposal_versions (what they saw: blocks, pricing, totals,
-- dates, and the estimate as it was), then bumps proposals.revision. Sending
-- emails them "Updated proposal" and their page shows when it was revised.
-- sent_revision is the revision last published to them, so an amendment that
-- hasn't gone out yet is revision > sent_revision.
-- Signed proposals aren't amended (the signature and invoice belong to that
-- version). RLS on, no policies, like every proposal table. Re-runnable.

alter table public.proposals
  add column if not exists revision integer not null default 1,
  add column if not exists sent_revision integer not null default 1,
  add column if not exists amended_at timestamptz;

create table if not exists public.proposal_versions (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  revision    integer not null,
  title       text not null,
  total_cents bigint not null default 0,
  status      text not null,          -- the proposal's status when it was replaced
  sent_at     timestamptz,            -- when that version first went out
  snapshot    jsonb not null,         -- title, dates, theme, deposit, blocks, lineItems
  estimate    jsonb,                  -- its estimate as it was (number, lines, total)
  created_at  timestamptz not null default now(),
  unique (proposal_id, revision)
);

create index if not exists proposal_versions_proposal_idx on public.proposal_versions (proposal_id, revision desc);

alter table public.proposal_versions enable row level security;
