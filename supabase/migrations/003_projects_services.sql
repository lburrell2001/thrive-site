-- Add services array column to projects table
-- Used to track which service pages a project is featured on
alter table projects
  add column if not exists services text[] not null default '{}';

-- Add order_index for manual ordering of projects
alter table projects
  add column if not exists order_index integer not null default 0;
