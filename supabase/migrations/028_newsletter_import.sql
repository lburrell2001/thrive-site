-- ============================================================
-- NEWSLETTER IMPORT — send an email designed in Canva
-- ============================================================
-- Canva Email exports a design as HTML plus images. Importing one stores
-- the sanitized HTML here, with its images re-hosted in the public
-- course-media bucket so they can't break. An imported design takes
-- precedence over blocks and body; the unsubscribe footer and mailing
-- address are still added at send time.

alter table public.newsletters
  add column if not exists html text,
  -- { file, images, bytes, warnings[], imported_at }
  add column if not exists html_meta jsonb;
