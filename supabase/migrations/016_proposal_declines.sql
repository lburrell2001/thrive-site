-- ============================================================
-- DECLINING A PROPOSAL
-- ============================================================
-- A client can say no from the same page they would sign on, and say why.
-- The current state lives on the proposal so list views can show it without
-- a join; the full history — who, when, from where — stays in
-- proposal_events, which already records 'declined'.
--
-- Re-publishing a declined proposal clears these, because the normal flow
-- after a decline is to revise and send it again. The event log keeps the
-- record either way.

alter table public.proposals
  add column if not exists declined_at    timestamptz,
  add column if not exists decline_reason text;

comment on column public.proposals.decline_reason is
  'Why the client declined, in their words. Cleared if the proposal is re-published.';
