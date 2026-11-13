-- 064: payment terms on estimates.
--
-- An estimate can ask for a deposit to start: estimates.deposit_percent
-- (null or 0 = invoiced in full). When the client accepts, the invoice it
-- becomes asks for just the deposit now; the balance stays locked until
-- Lauren opens it (portal_invoices.deposit_cents / balance_open, migration
-- 048) — the same as a signed proposal's deposit. A proposal's estimate
-- takes the proposal's deposit; an estimate made from a phase takes the
-- phase's terms ("50% to start").

alter table public.estimates add column if not exists deposit_percent numeric
  check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent <= 100));
