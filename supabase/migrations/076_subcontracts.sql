-- Subcontract work (076): a deal where Thrive works under another company
-- (the "prime": an agency, developer, marketing firm) for that company's
-- client. The deal's contact is the prime; end_client is who the work is for.
-- steps holds the protocol steps ticked by hand ({ key: iso time }); the rest
-- are read from estimates, invoices, the portal and the deal (subcontract.ts).

create table if not exists subcontract_jobs (
  deal_id uuid primary key references crm_deals(id) on delete cascade,
  end_client text check (end_client is null or char_length(end_client) <= 160),
  notes text check (notes is null or char_length(notes) <= 4000),
  steps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server routes only (vault pattern): RLS on, no policies.
alter table subcontract_jobs enable row level security;
