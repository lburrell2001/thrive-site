-- ============================================================
-- RESTORE COLUMNS FROM 005, 010 AND 012
-- ============================================================
-- Migrations 005, 010 and 012 were recorded as applied without ever having
-- run, so three columns the application code depends on were missing from
-- the database:
--
--   projects.cover_image              (005) — portfolio cover art
--   portal_invoices.subscription_id   (010) — recurring-invoice link
--   portal_requests.project_name      (012) — filing a brain dump
--
-- The brain dump inbox was the visible symptom: /portal/requests writes
-- project_name on submit, so every submission failed.
--
-- Applied forward rather than by rewriting migration history, so the
-- earlier files stay untouched and this fix is explicit in the log.
-- Every statement is idempotent.

-- ---------------------------------------------------------- 005
alter table public.projects
  add column if not exists cover_image text;

update public.projects
   set cover_image = 'work/' || slug || '-cover.jpg'
 where slug in (
   'brewhaus', 'burrell-group', 'curl-co', 'dj-mastamind', 'safespace',
   'soulcheck', 'squeeze-shop', 'st-john', 'tckt', 'thrive-site'
 )
   and (cover_image is null or cover_image = '');

-- ---------------------------------------------------------- 010
alter table public.portal_invoices
  add column if not exists subscription_id uuid
    references public.portal_invoice_subscriptions(id) on delete set null;

create index if not exists portal_invoices_subscription_idx
  on public.portal_invoices (subscription_id) where subscription_id is not null;

-- ---------------------------------------------------------- 012
alter table public.portal_requests
  add column if not exists project_name text;
