-- ============================================================
-- SITE VISITORS — one id per browser, across visits
-- ============================================================
-- site_pageviews.session_id lasts one visit and visitor_hash rotates daily,
-- so a person who comes back three times looks like three strangers.
-- visitor_id is a random id the browser keeps in localStorage (no cookie),
-- so /admin/crm/visitors can show return visits. It is never tied to a
-- name by itself: a visitor is linked to a CRM contact only when one of
-- their visits sent an inquiry or booked a call (contact_inquiries.session_id).

alter table public.site_pageviews
  add column if not exists visitor_id text;

create index if not exists site_pageviews_visitor_idx
  on public.site_pageviews (visitor_id, created_at) where visitor_id is not null;

create index if not exists contact_inquiries_session_idx
  on public.contact_inquiries (session_id) where session_id is not null;
