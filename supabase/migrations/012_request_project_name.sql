-- ============================================================
-- REQUEST → PROJECT FILING
-- Clients submit requests from /portal/requests with no project attached;
-- the admin Request Inbox files them under a project by name.
--
-- This column is already present in the live database — it was added by hand
-- before this migration existed. Recorded here so a fresh environment matches.
-- ============================================================

alter table portal_requests
  add column if not exists project_name text;
