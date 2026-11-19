-- 069: pay over time.
--
-- An estimate's payment terms can be a plan: estimates.payment_plan =
-- [{ cents, days }] — each payment's amount and how many days after they
-- accept it's due (0 = when they accept). The amounts add up to the total.
-- When they accept, the invoice gets portal_invoices.installments =
-- [{ cents, due_date, paid_at }]. Payment 1 is also stored as the invoice's
-- deposit (deposit_cents / deposit_due_date / deposit_paid_at), so paying it
-- wins the deal and starts the work exactly like a deposit (048, 065); the
-- later payments come due on their own dates, and the last one marks the
-- invoice paid. Re-runnable.

alter table public.estimates add column if not exists payment_plan jsonb;
alter table public.portal_invoices add column if not exists installments jsonb;
