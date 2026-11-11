-- 057: portal setup prompts.
--
-- Every new portal project shows a "Set up the portal" checklist (send the
-- portal invite, assign questionnaires, add an estimate or invoice, add
-- milestones) on the client tab and in Home's Needs you, until each step is
-- done or Lauren skips it. portal_projects.setup_done_at marks it finished.
-- Projects made before today are marked done so the list starts clean.
-- Safe to run more than once.

alter table public.portal_projects add column if not exists setup_done_at timestamptz;

update public.portal_projects
   set setup_done_at = now()
 where setup_done_at is null and created_at < '2026-11-10T06:00:00Z';
