-- ============================================================
-- EVERY PROPOSAL HAS AN ESTIMATE
-- ============================================================
-- proposals.estimate_id: the estimate that goes with the proposal. It is
-- built from the proposal pricing (src/lib/proposalEstimate.ts) and rebuilt
-- whenever that pricing changes, so the two always match; a proposal made
-- from an estimate keeps that estimate. The client can download it from
-- the proposal page.
--
-- The estimate follows the proposal: published (sent or viewed) makes it
-- Sent, signed makes it Accepted, declined makes it Declined. An estimate
-- already turned into an invoice is left alone.
-- Safe to run more than once.

alter table public.proposals
  add column if not exists estimate_id uuid references public.estimates(id) on delete set null;

create unique index if not exists proposals_estimate_idx
  on public.proposals (estimate_id) where estimate_id is not null;

create or replace function public.crm_proposal_estimate_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if new.estimate_id is null or new.status is not distinct from old.status then return null; end if;
  next_status := case new.status
    when 'sent' then 'sent'
    when 'viewed' then 'sent'
    when 'signed' then 'accepted'
    when 'declined' then 'declined'
    else null
  end;
  if next_status is null then return null; end if;
  update public.estimates
     set status = next_status, updated_at = now()
   where id = new.estimate_id and status <> 'invoiced' and status <> next_status;
  return null;
end $$;

drop trigger if exists proposals_estimate_status on public.proposals;
create trigger proposals_estimate_status
  after update of status on public.proposals
  for each row execute function public.crm_proposal_estimate_status();
