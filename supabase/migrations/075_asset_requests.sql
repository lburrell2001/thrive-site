-- Asset requests (075): Lauren asks a client for the things she needs to do
-- the work (logo files, photos, copy, brand guide…). One request is a list of
-- items; for each, the client uploads files, pastes a link (Drive, Dropbox,
-- WeTransfer) or says they don't have it, then sends it back. Files go to the
-- private client-documents bucket under assets/<client>/<request>/<item>/.
--
-- status: open (waiting on the client) → submitted (they sent it) → received
-- (Lauren has what she needs). Reopen puts it back to open.

create table if not exists asset_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  note text check (note is null or char_length(note) <= 2000),
  due_date date,
  status text not null default 'open' check (status in ('open', 'submitted', 'received')),
  submitted_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists asset_requests_client on asset_requests (client_id, created_at desc);
create index if not exists asset_requests_waiting on asset_requests (status) where status <> 'received';

create table if not exists asset_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references asset_requests(id) on delete cascade,
  position int not null default 0,
  label text not null check (char_length(label) between 1 and 160),
  hint text check (hint is null or char_length(hint) <= 500),
  required boolean not null default true,
  -- [{ path, name, size, type, uploaded_at }]
  files jsonb not null default '[]'::jsonb,
  link text check (link is null or char_length(link) <= 1000),
  client_note text check (client_note is null or char_length(client_note) <= 2000),
  unavailable boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists asset_request_items_request on asset_request_items (request_id, position);

-- Server routes only (vault pattern): RLS on, no policies.
alter table asset_requests enable row level security;
alter table asset_request_items enable row level security;
