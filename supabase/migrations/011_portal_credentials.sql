-- ============================================================
-- SECURE CREDENTIALS VAULT
-- Clients hand over website hosts, CMS logins, domain registrars
-- and other sensitive access details without texting or emailing them.
--
-- Secrets are encrypted with AES-256-GCM in the application layer
-- (see src/lib/credentialCrypto.ts) BEFORE they reach this table.
-- A database leak alone therefore exposes no passwords.
-- ============================================================

create table if not exists portal_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  label text not null,
  category text not null default 'other',
  -- website_host | domain | cms | ftp | analytics | social | email | other
  site_url text not null default '',
  username text not null default '',
  secret_encrypted text not null default '',   -- AES-256-GCM ciphertext, never plaintext
  notes_encrypted text not null default '',    -- AES-256-GCM ciphertext, never plaintext
  last_viewed_at timestamptz,
  last_viewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_credentials_client_idx
  on portal_credentials (client_id, created_at desc);

alter table portal_credentials enable row level security;

-- Deliberately NO policies for the anon/authenticated roles.
-- Unlike the other portal tables, clients never touch this one with the public
-- anon key — every read and write goes through a server route holding the
-- service role key, which bypasses RLS. That keeps ciphertext out of the browser
-- and forces every reveal through an authenticated, logged code path.
