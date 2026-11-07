-- ============================================================
-- CLOSING FINISHED DEALS
-- ============================================================
-- The pipeline is for live work: leads, open deals, and won work still
-- running. A won deal is closed when the work is over — automatically for a
-- monthly retainer once its last month ends (src/lib/dealClose.ts, run daily
-- and whenever the pipeline loads), or by hand with "Close" in the contact
-- panel (e.g. a retainer ending early, a one-off project delivered).
--
-- Closing keeps the deal Won — totals, lifecycle and history are unchanged —
-- but takes it off the board, archives its portal projects and stops their
-- recurring invoices. Reopen clears it.
-- Safe to run more than once.

alter table public.crm_deals
  add column if not exists closed_at timestamptz,
  -- 'retainer_ended' | 'manual'
  add column if not exists closed_reason text;

create index if not exists crm_deals_open_won_idx on public.crm_deals (stage) where closed_at is null;
