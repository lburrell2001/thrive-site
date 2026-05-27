-- Recurring invoice subscriptions
-- A subscription generates invoices on a monthly cadence until paused/cancelled.
create table if not exists portal_invoice_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_name text not null default '',
  invoice_prefix text not null default 'INV',
  amount_cents int not null,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  next_due_date date not null,
  last_generated_date date,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists portal_invoice_subscriptions_client_idx
  on portal_invoice_subscriptions (client_id);
create index if not exists portal_invoice_subscriptions_due_idx
  on portal_invoice_subscriptions (next_due_date) where status = 'active';

alter table portal_invoice_subscriptions enable row level security;

-- Clients can view (but not edit) their own subscriptions
create policy "clients can view own subscriptions"
  on portal_invoice_subscriptions for select using (auth.uid() = client_id);
