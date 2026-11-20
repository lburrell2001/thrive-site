-- Drafts and locked final files (073).
-- A delivered file is a draft (the client only ever sees a watermarked preview)
-- or a final copy. A final copy can be locked to an invoice: until that invoice
-- is paid in full the client sees the watermarked preview and can't download it.
-- The original stays in the private client-documents bucket (no storage policies),
-- so only the server can hand it out.

alter table portal_files
  add column if not exists stage text not null default 'final' check (stage in ('draft', 'final')),
  add column if not exists unlock_invoice_id uuid references portal_invoices(id) on delete set null,
  add column if not exists preview_path text;

-- Clients read their files through /api/portal/documents (which only signs what
-- they may download); the old direct select is kept for the dashboard count, but
-- it never returns a usable link: file_url is a private storage path.
