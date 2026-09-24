-- ============================================================
-- REVIEWS — asking clients for testimonials, and showing them
-- ============================================================
-- Admin asks a client for a review from their deal in the CRM. The client
-- gets a private link (/review/<token>), leaves a rating and a few words,
-- and says whether Thrive may publish it. Admin approves it, and approved
-- reviews appear on the matching service page.
--
-- Stars in Google's results are not a goal here: Google ignores review
-- markup a business puts on its own site about itself. Reviews that help
-- search are the ones on the Google Business Profile, which the thank-you
-- screen asks for.

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  -- The private link. Null for testimonials added by hand.
  token           text unique,
  crm_contact_id  uuid references public.crm_contacts(id) on delete set null,
  crm_deal_id     uuid references public.crm_deals(id) on delete set null,
  service_slug    text,
  -- As the reviewer wants to be shown, e.g. "Maya R." and "Owner, Bloom Co."
  display_name    text,
  display_role    text,
  rating          smallint check (rating between 1 and 5),
  body            text,
  -- The reviewer's own yes to being quoted on the website.
  consent_publish boolean not null default false,
  -- 'requested' → 'submitted' → 'approved' | 'hidden'
  status          text not null default 'requested'
                  check (status in ('requested', 'submitted', 'approved', 'hidden')),
  featured        boolean not null default false,
  requested_at    timestamptz,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Nothing reaches the site without the reviewer's consent.
  constraint reviews_approved_needs_consent check (status <> 'approved' or consent_publish)
);

create index if not exists reviews_public_idx
  on public.reviews (service_slug, featured desc, approved_at desc) where status = 'approved';
create index if not exists reviews_contact_idx on public.reviews (crm_contact_id);

create or replace function public.reviews_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
  end if;
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end $$;

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch
  before insert or update on public.reviews
  for each row execute function public.reviews_touch();

-- The public site reads approved reviews with the anon key, and only the
-- columns it shows. Requests, tokens and unapproved reviews stay behind
-- the service role.
alter table public.reviews enable row level security;

drop policy if exists "approved reviews are public" on public.reviews;
create policy "approved reviews are public"
  on public.reviews for select
  to anon, authenticated
  using (status = 'approved' and consent_publish);

revoke select on public.reviews from anon, authenticated;
grant select (id, service_slug, display_name, display_role, rating, body, featured, approved_at)
  on public.reviews to anon, authenticated;
