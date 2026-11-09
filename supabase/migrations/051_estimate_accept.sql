-- ============================================================
-- CLIENTS ACCEPT ESTIMATES
-- ============================================================
-- An estimate gets a private link (/e/<id>?t=<access_token>), like a
-- proposal. The Send email opens it; at the bottom the client can export
-- the PDF or accept. Accepting records who and when (accepted_at,
-- accepted_by, accepted_ip), marks it accepted (which wins the deal, migration
-- 049), and turns it into an invoice in the project folder in their portal
-- (src/lib/estimateInvoice.ts; estimates.invoice_id). A signed proposal does
-- the same with its estimate, deposit first.
--
-- sent_to: the address the estimate was emailed to, used to give the client
-- a portal login when they had none.
-- Safe to run more than once.

alter table public.estimates
  add column if not exists access_token text,
  add column if not exists sent_to      text,
  add column if not exists accepted_at  timestamptz,
  add column if not exists accepted_by  text,
  add column if not exists accepted_ip  text;

alter table public.estimates
  alter column access_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

update public.estimates
   set access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where access_token is null;

create unique index if not exists estimates_access_token_idx on public.estimates (access_token);
