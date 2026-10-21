-- ============================================================
-- INSTAGRAM AND FACEBOOK PROSPECTS
-- ============================================================
-- Lauren reaches out to some businesses by DM instead of email. A contact
-- can now carry an Instagram handle and a Facebook page, and a prospect
-- needs only one of email / Instagram / Facebook.
--
-- DMs are logged by hand as crm_activities rows with kind 'dm' and
-- metadata { platform: 'instagram' | 'facebook', direction: 'sent' | 'received' }.
-- kind has no check constraint, so nothing changes there.
--
-- Safe to run more than once.

alter table public.crm_contacts
  -- Handle without the @, lowercased: "bloom.bakery".
  add column if not exists instagram text,
  -- The part after facebook.com/: "bloombakery" or "profile.php?id=1000…".
  add column if not exists facebook text;

-- Adding a prospect looks people up by handle so nobody is added twice.
create index if not exists crm_contacts_instagram_idx on public.crm_contacts (instagram) where instagram is not null;
create index if not exists crm_contacts_facebook_idx on public.crm_contacts (facebook) where facebook is not null;
