-- ============================================================
-- MARKETING CAMPAIGNS — print, tracked like email
-- ============================================================
-- A print campaign is one piece (a postcard, a flyer, a mailer) sent on a
-- date, at a cost, to a list of CRM contacts. Emails already record who
-- they reached (newsletter_sends, prospect_emails); this gives print the
-- same, so the Campaigns page can compare every piece side by side.
--
-- Success is counted three ways:
--   * scans of the campaign's QR code / short link (/m/<code>), logged here
--   * inquiries tagged with the campaign (the short link adds
--     utm_campaign=<code>, which contact_inquiries already records)
--   * Lauren marking a recipient as responded / lead / won by hand

create table if not exists public.marketing_campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  -- 'postcard' | 'flyer' | 'letter' | 'door_hanger' | 'brochure' | 'leave_behind' | 'other'
  piece        text not null default 'postcard'
               check (piece in ('postcard', 'flyer', 'letter', 'door_hanger', 'brochure', 'leave_behind', 'other')),
  sent_on      date,
  cost_cents   integer check (cost_cents is null or cost_cents >= 0),
  notes        text not null default '',
  -- The short link: thrivecreativestudios.org/m/<code>. Lowercase, unique.
  code         text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  -- Where the short link lands, a path on the site.
  destination  text not null default '/' check (destination like '/%'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.marketing_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.marketing_campaigns(id) on delete cascade,
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  -- sent → responded (got in touch) → lead (opened a deal) → won;
  -- or no_response once Lauren calls it.
  outcome       text not null default 'sent'
                check (outcome in ('sent', 'responded', 'lead', 'won', 'no_response')),
  outcome_at    timestamptz,
  note          text not null default '',
  created_at    timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index if not exists marketing_recipients_contact_idx on public.marketing_recipients (contact_id);

create table if not exists public.marketing_scans (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.marketing_campaigns(id) on delete cascade,
  -- Daily-rotating hash of IP + user agent (as site_pageviews): counts
  -- unique scanners without storing who they are.
  visitor      text not null,
  device       text,
  scanned_at   timestamptz not null default now()
);

create index if not exists marketing_scans_campaign_idx on public.marketing_scans (campaign_id, scanned_at desc);

-- Same posture as the CRM: RLS on, no policies; server routes only.
alter table public.marketing_campaigns  enable row level security;
alter table public.marketing_recipients enable row level security;
alter table public.marketing_scans      enable row level security;
