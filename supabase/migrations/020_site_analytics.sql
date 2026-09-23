-- ============================================================
-- SITE ANALYTICS — first-party page views, and where inquiries came from
-- ============================================================
-- Vercel Analytics and Google Tag Manager stay as they are, but their data
-- cannot be read back into admin. This table can, and it sits next to the
-- CRM, so admin can answer "which sources bring clients", not just
-- "which bring visits".
--
-- No cookies and no IP addresses. A visitor is a hash of IP + user agent +
-- the day, keyed with a server secret, so it cannot be reversed and cannot
-- follow anyone past midnight. A session id lives in the browser's
-- sessionStorage for the tab's lifetime.

create table if not exists public.site_pageviews (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    text not null,
  visitor_hash  text not null,
  path          text not null,
  -- First page of the session. Source fields are only filled on landings;
  -- later pages in the session inherit them through session_id.
  is_landing    boolean not null default false,
  referrer_host text,
  source        text,            -- 'Google', 'Instagram', 'Direct', or a host
  -- 'search' | 'social' | 'ai' | 'referral' | 'email' | 'paid' | 'direct'
  channel       text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  click_id      text,            -- 'gclid' | 'fbclid' | 'msclkid' when an ad click
  device        text,            -- 'mobile' | 'tablet' | 'desktop'
  country       text,
  region        text,
  city          text,
  -- Time the page was visible, reported when the visitor leaves it.
  engaged_ms    integer
);

create index if not exists site_pageviews_created_idx on public.site_pageviews (created_at desc);
create index if not exists site_pageviews_session_idx on public.site_pageviews (session_id, created_at);

-- Where each inquiry came from: the session it was sent in, and the first
-- visit this browser ever made (someone often finds the site on Instagram
-- and comes back through Google a week later to write in).
alter table public.contact_inquiries
  add column if not exists session_id    text,
  add column if not exists source        text,
  add column if not exists channel       text,
  add column if not exists landing_path  text,
  add column if not exists utm_campaign  text,
  add column if not exists first_source  text,
  add column if not exists first_channel text;

-- Same posture as the CRM tables: RLS on, no policies. Writes come from
-- /api/track and reads from the admin dashboard, both with the service role.
alter table public.site_pageviews enable row level security;
