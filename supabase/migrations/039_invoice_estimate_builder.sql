-- ============================================================
-- INVOICE AND ESTIMATE BUILDER
-- ============================================================
-- /admin/invoices builds invoices and estimates from a typed list, one
-- item per line (src/lib/lineItems.ts parses it).
--
-- Invoices still live in portal_invoices, so the portal, Stripe, reminders
-- and the CRM deal triggers work as before. They now carry their lines and
-- a note for the PDF. amount_cents stays the total; older invoices have no
-- lines and print as one line, as before.
--
-- line_items is an array of
--   { name, description, hours, rate_cents, amount_cents }
-- where hours and rate_cents may be null.
--
-- Estimates are new: admin-only (RLS on, no policies), numbered EST-001…,
-- for a portal client, a CRM contact or just a typed name. Turning one into
-- an invoice links it through invoice_id.
--
-- Safe to run more than once.

alter table public.portal_invoices
  add column if not exists line_items jsonb,
  add column if not exists notes text;

create table if not exists public.estimates (
  id               uuid primary key default gen_random_uuid(),
  estimate_number  text not null unique,
  portal_client_id uuid references public.portal_clients(id) on delete set null,
  crm_contact_id   uuid references public.crm_contacts(id) on delete set null,
  client_name      text not null default '',
  title            text not null default '',
  line_items       jsonb not null default '[]'::jsonb,
  notes            text,
  total_cents      integer not null default 0,
  issue_date       date not null default current_date,
  valid_until      date,
  -- draft | sent | accepted | declined | invoiced
  status           text not null default 'draft'
                   check (status in ('draft', 'sent', 'accepted', 'declined', 'invoiced')),
  invoice_id       uuid references public.portal_invoices(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists estimates_created_idx on public.estimates (created_at desc);

alter table public.estimates enable row level security;
revoke all on public.estimates from anon, authenticated;
