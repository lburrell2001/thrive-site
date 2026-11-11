-- 060: case studies edited in admin → Portfolio.
-- projects.case_study holds the whole case study (the CaseStudy type in
-- src/app/work/caseStudies.ts). When set it wins over the code file in
-- src/app/work/case-studies/<slug>.ts. Public reads already go through the anon
-- key on projects, so no policy changes are needed.
alter table public.projects add column if not exists case_study jsonb;
