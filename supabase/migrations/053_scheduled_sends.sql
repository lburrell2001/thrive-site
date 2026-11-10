-- 053: schedule sending proposals, estimates and invoices.
--
-- Each row is one send waiting for its time: what it is (kind), what it is for
-- (target_id: the proposal or estimate; null for an invoice, which is only
-- created when it goes out), and what the Send dialog would have posted
-- (payload). The five-minute cron (/api/cron/scheduled-emails) claims due rows
-- (scheduled -> sending) and sends them with the same code as Send now.
-- Emails already schedule themselves (newsletters, prospect_drafts: 032).
--
-- Admin-only: RLS on, no policies; read and written by server routes with the
-- service role key. Safe to run more than once.

create table if not exists public.scheduled_sends (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('proposal', 'estimate', 'invoice')),
  target_id  uuid,
  label      text not null default '',
  payload    jsonb not null default '{}'::jsonb,
  send_at    timestamptz not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  error      text,
  result     jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create index if not exists scheduled_sends_due_idx on public.scheduled_sends (send_at) where status = 'scheduled';
create index if not exists scheduled_sends_target_idx on public.scheduled_sends (kind, target_id);

alter table public.scheduled_sends enable row level security;
revoke all on public.scheduled_sends from anon, authenticated;
