-- ============================================================
-- CONTACT ROLE (JOB TITLE)
-- ============================================================
-- What someone does: "Owner", "Marketing manager". Shown next to their
-- name and company in the CRM, set from the contact panel's Details or
-- when adding a prospect. Named job_title so it isn't confused with
-- portal_clients.role (client / admin).
--
-- Safe to run more than once.

alter table public.crm_contacts
  add column if not exists job_title text;
