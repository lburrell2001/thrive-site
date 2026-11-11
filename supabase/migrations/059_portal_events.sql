-- 059: what clients do in the portal.
--
-- One row per event: a sign-in (email code verified), a visit (a browser
-- session in the portal, signed in fresh or returning), each page they view
-- with how long they spent on it while it was on screen (duration_ms, updated
-- as they leave), and actions (paid, downloaded a PDF, accepted or declined an
-- invoice, sent a brain dump…). Written by POST /api/portal/track with the
-- client's own token; read by admin only (Client tab → Portal activity).
--
-- RLS on, no policies: only server routes read or write it. Safe to run more than once.

create table if not exists public.portal_events (
  id          uuid primary key,
  client_id   uuid not null references public.portal_clients(id) on delete cascade,
  session_id  text not null,
  kind        text not null check (kind in ('sign_in', 'visit', 'page', 'action')),
  path        text,
  label       text,
  started_at  timestamptz not null default now(),
  duration_ms integer not null default 0,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists portal_events_client_idx on public.portal_events (client_id, started_at desc);
create index if not exists portal_events_session_idx on public.portal_events (session_id);

alter table public.portal_events enable row level security;
revoke all on public.portal_events from anon, authenticated;
