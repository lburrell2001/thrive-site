-- Link invoices back to the subscription that generated them (if any).
alter table portal_invoices
  add column if not exists subscription_id uuid
    references portal_invoice_subscriptions(id) on delete set null;

create index if not exists portal_invoices_subscription_idx
  on portal_invoices (subscription_id) where subscription_id is not null;
