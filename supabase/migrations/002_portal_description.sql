-- Add description field to portal_requests
alter table portal_requests
  add column if not exists description text not null default '';

-- Allow clients to update their own profile
-- (already covered by the "all" policy in 001, but explicit is better)
-- portal_clients policy "clients can manage own profile" covers update already
