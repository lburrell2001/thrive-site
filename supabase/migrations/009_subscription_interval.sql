-- Add configurable interval to invoice subscriptions
alter table portal_invoice_subscriptions
  add column if not exists interval_unit  text not null default 'month'
    check (interval_unit in ('week','month','year')),
  add column if not exists interval_count int  not null default 1
    check (interval_count between 1 and 24);
