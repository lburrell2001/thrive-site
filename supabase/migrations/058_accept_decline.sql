-- 058: clients accept or decline estimates and invoices, with a reason.
--
-- Estimates: declined on their page (/e/<id>) with a reason; status becomes
-- declined (the deal is left as it is, 049).
-- Invoices: in the portal, Accept (they agree to it, then pay as usual) or
-- Decline with a reason, which stops reminders and the overdue sweep and
-- hides Pay until Lauren reopens it.
-- Proposals already decline with a reason (decline_reason, 010).
--
-- Safe to run more than once.

alter table public.estimates
  add column if not exists declined_at    timestamptz,
  add column if not exists declined_by    text,
  add column if not exists decline_reason text;

alter table public.portal_invoices
  add column if not exists accepted_at    timestamptz,
  add column if not exists accepted_by    text,
  add column if not exists declined_at    timestamptz,
  add column if not exists decline_reason text;
