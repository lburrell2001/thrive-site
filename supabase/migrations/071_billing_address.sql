-- 071: each portal client's billing address, printed under "Billed to" on
-- their invoice PDFs and payment receipts. Lauren sets it on the Client tab;
-- clients can change it themselves in portal Settings (column grant). Re-runnable.

alter table public.portal_clients
  add column if not exists billing_address text;

grant update (billing_address) on public.portal_clients to authenticated;
