-- ============================================================
-- PROSPECTS, ONE EMAILS AREA, AND REPLIES
-- ============================================================
-- Prospects are people Lauren reaches out to before they have shown any
-- interest. They live in their own list, not on the pipeline board. The
-- moment one of them gets a deal (they reply to an email, send an inquiry,
-- or Lauren opens one by hand) they are 'converted' and the board takes
-- over.
--
-- Newsletters and prospect emails become one thing: an email, designed
-- once, sent to an audience (subscribers, prospects, a tag, or hand-picked
-- contacts). The newsletters table carries them all; templates for both
-- live in email_templates.
--
-- Replies arrive through Resend's inbound webhook and are stored in
-- email_replies, each linked to the contact it came from.

-- --------------------------------------------------------- prospects

alter table public.crm_contacts
  add column if not exists prospect_status text check (prospect_status in ('prospect', 'converted')),
  add column if not exists prospected_at timestamptz,
  add column if not exists converted_at timestamptz,
  -- The last time they wrote back to any email.
  add column if not exists replied_at timestamptz,
  add column if not exists website text;

create index if not exists crm_contacts_prospect_idx on public.crm_contacts (prospect_status) where prospect_status = 'prospect';

-- Any new deal for a prospect converts them, however it was opened.
create or replace function public.crm_convert_prospect()
returns trigger
language plpgsql
as $$
begin
  update public.crm_contacts
     set prospect_status = 'converted', converted_at = now()
   where id = new.contact_id and prospect_status = 'prospect';
  return new;
end $$;

drop trigger if exists crm_deals_convert_prospect on public.crm_deals;
create trigger crm_deals_convert_prospect
  after insert on public.crm_deals
  for each row execute function public.crm_convert_prospect();

-- ------------------------------------------------- one template table

alter table if exists public.prospect_templates rename to email_templates;

-- Newsletter templates join them as designed templates.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'newsletter_templates') then
    insert into public.email_templates (name, style, blocks, design, created_at, updated_at)
    select t.name, 'designed', t.blocks, t.design, t.created_at, t.updated_at
      from public.newsletter_templates t
     where not exists (select 1 from public.email_templates e where e.name = t.name and e.style = 'designed');
  end if;
end $$;

-- --------------------------------------------------------- one email

alter table public.newsletters
  -- 'designed' (sections), 'personal' (looks typed); null = older markdown newsletters.
  add column if not exists style text check (style in ('designed', 'personal')),
  add column if not exists audience_contact_ids uuid[] not null default '{}';

update public.newsletters set style = 'designed' where style is null and jsonb_array_length(blocks) > 0;

alter table public.newsletters drop constraint if exists newsletters_audience_check;
alter table public.newsletters add constraint newsletters_audience_check
  check (audience in ('subscribers', 'clients', 'leads', 'tag', 'prospects', 'prospect_tag', 'contacts'));

-- ------------------------------------------------------------ replies

create table if not exists public.email_replies (
  id               uuid primary key default gen_random_uuid(),
  -- Resend's id for the received email: a redelivered webhook is ignored.
  resend_email_id  text not null unique,
  contact_id       uuid references public.crm_contacts(id) on delete set null,
  from_email       text not null,
  from_name        text,
  subject          text not null default '',
  -- The reply, without the quoted email below it where that can be found.
  text             text not null default '',
  -- Whether the reply was forwarded to Lauren's inbox, and why not if not.
  forwarded        boolean not null default false,
  forward_error    text,
  -- Set when Lauren marks it dealt with on the Today page.
  handled_at       timestamptz,
  received_at      timestamptz not null default now()
);

create index if not exists email_replies_contact_idx on public.email_replies (contact_id, received_at desc);
create index if not exists email_replies_open_idx on public.email_replies (received_at desc) where handled_at is null;

alter table public.email_replies enable row level security;
