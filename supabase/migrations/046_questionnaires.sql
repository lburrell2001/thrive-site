-- 046: Service questionnaires.
--
-- Lauren builds questionnaires in admin (Clients → Questionnaires): sections,
-- questions, options. She assigns them to portal clients (optionally for one
-- project), switching on any optional sections for that client; the client
-- fills them out in the portal (/portal/onboarding) and submits.
--
-- Security matches the credentials vault: RLS on with NO policies, so the
-- anon key can't read or write any of this. Every read and write goes through
-- a server route with the service role key, which enforces the rules:
-- clients see only what's assigned to them, write only their own answers, and
-- can't change anything after submitting unless Lauren reopens it.
--
-- Uploaded files go to the private `client-documents` bucket under
-- questionnaires/<client id>/<assignment id>/…, listed in the answer's value
-- as [{ path, name, size, type }] (several files per question).
--
-- Deleting: a question, section or questionnaire that has answers is
-- archived (is_archived) instead, so past submissions stay intact; one with
-- no answers is deleted. Each answer keeps question_prompt_snapshot, the text
-- the client saw when they answered.
--
-- Seeds seven questionnaires (About You, Branding, Website Development with an
-- optional App Development section, Social Media, UX/UI Design, Photography).
-- Seeding skips any slug that already exists, so this file is safe to re-run.

create table if not exists questionnaires (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  service_type text not null default 'custom'
    check (service_type in ('about_you', 'branding', 'website', 'app_development', 'social_media', 'ux_ui', 'photography', 'custom')),
  is_active boolean not null default true,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_optional boolean not null default false,
  optional_label text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists questionnaire_sections_q on questionnaire_sections (questionnaire_id, sort_order);

create table if not exists questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references questionnaire_sections(id) on delete cascade,
  prompt text not null,
  help_text text not null default '',
  type text not null default 'long_text'
    check (type in ('short_text', 'long_text', 'single_choice', 'multi_choice', 'checkbox_list', 'yes_no', 'url', 'date', 'file_upload')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questionnaire_questions_s on questionnaire_questions (section_id, sort_order);

create table if not exists client_questionnaires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  questionnaire_id uuid not null references questionnaires(id),
  include_optional_sections jsonb not null default '[]'::jsonb,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'reopened')),
  assigned_at timestamptz not null default now(),
  submitted_at timestamptz,
  reopened_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists client_questionnaires_client on client_questionnaires (client_id, assigned_at desc);
create index if not exists client_questionnaires_open on client_questionnaires (status) where status <> 'submitted';

create table if not exists questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  client_questionnaire_id uuid not null references client_questionnaires(id) on delete cascade,
  -- restrict: a question with answers is archived, never deleted.
  question_id uuid not null references questionnaire_questions(id) on delete restrict,
  question_prompt_snapshot text not null default '',
  value jsonb,
  updated_at timestamptz not null default now(),
  unique (client_questionnaire_id, question_id)
);
create index if not exists questionnaire_answers_question on questionnaire_answers (question_id);

alter table questionnaires enable row level security;
alter table questionnaire_sections enable row level security;
alter table questionnaire_questions enable row level security;
alter table client_questionnaires enable row level security;
alter table questionnaire_answers enable row level security;

-- Seed ------------------------------------------------------------------
do $$
declare
  qid uuid;
  sid uuid;
begin
  -- About You
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('about-you', 'About You', 'The basics about you and your business. Every project starts here.', 'about_you', 1)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'About You', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'What’s your business name, and how do you want it written publicly?', 'short_text', '[]'::jsonb, true, 1),
      (sid, 'Who’s the main contact for this project, and what’s the best way to reach you?', 'short_text', '[]'::jsonb, true, 2),
      (sid, 'In a few sentences, what does your business do?', 'long_text', '[]'::jsonb, false, 3),
      (sid, 'What’s the story behind it? Why did you start it?', 'long_text', '[]'::jsonb, false, 4),
      (sid, 'Who are your customers? Describe your ideal one.', 'long_text', '[]'::jsonb, false, 5),
      (sid, 'What makes you different from others who do what you do?', 'long_text', '[]'::jsonb, false, 6),
      (sid, 'Who are 2–3 competitors or businesses in your space?', 'long_text', '[]'::jsonb, false, 7),
      (sid, 'Which three words should people use to describe your brand?', 'short_text', '[]'::jsonb, false, 8),
      (sid, 'Which three words should they never use?', 'short_text', '[]'::jsonb, false, 9),
      (sid, 'Is there a deadline or event we’re working toward?', 'short_text', '[]'::jsonb, false, 10),
      (sid, 'Who else needs to approve work before it’s final?', 'short_text', '[]'::jsonb, false, 11),
      (sid, 'Anything else you want us to know before we start?', 'long_text', '[]'::jsonb, false, 12);
  end if;
  qid := null;
  -- Branding
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('branding', 'Branding', 'Where your brand is now, how it should look and feel, and where it will live.', 'branding', 2)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Where you are now', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Do you have a logo or brand materials right now? If yes, what do you like and dislike about them?', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'Is this a brand-new brand, a refresh, or a full rebrand?', 'single_choice', '["Brand-new","Refresh","Full rebrand"]'::jsonb, false, 2),
      (sid, 'Are you keeping your current name, or do you need help with naming or a tagline?', 'long_text', '[]'::jsonb, false, 3);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Look and feel', 2, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Share 3–5 brands you love the look of, inside or outside your industry. What do you love about each?', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'Share any brands or styles you don’t want to look like.', 'long_text', '[]'::jsonb, false, 2),
      (sid, 'Are there colors you love, colors you want to avoid, or colors that mean something to you or your culture?', 'long_text', '[]'::jsonb, false, 3),
      (sid, 'Is there a font style you lean toward?', 'multi_choice', '["Bold","Elegant","Playful","Handwritten","Modern","Classic","Not sure"]'::jsonb, false, 4),
      (sid, 'Are there symbols, patterns, places, or traditions that are part of your story and should show up in the brand?', 'long_text', '[]'::jsonb, false, 5),
      (sid, 'Should the brand feel loud and bold, warm and inviting, clean and calm, or something else?', 'long_text', '[]'::jsonb, false, 6),
      (sid, 'Upload any inspiration images', 'file_upload', '[]'::jsonb, false, 7);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Where it’ll live', 3, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Where will your brand show up most?', 'checkbox_list', '["Website","Social media","Signage","Packaging","Merch","Print","Uniforms","Other"]'::jsonb, false, 1),
      (sid, 'Which files do you need at the end?', 'checkbox_list', '["Logo variations","Brand guide","Social templates","Business cards","Other"]'::jsonb, false, 2),
      (sid, 'Do you have a trademark, or plan to file one?', 'single_choice', '["Yes","Planning to","No","Not sure"]'::jsonb, false, 3);
  end if;
  qid := null;
  -- Website Development
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('website-development', 'Website Development', 'Your goals, pages, features and technical setup for the new site.', 'website', 3)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Goals', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Do you have a website now? If yes, share the link and tell us what’s working and what isn’t.', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'What’s the #1 thing you want visitors to do on your site?', 'single_choice', '["Call","Book","Buy","Apply","Donate","Sign up","Other"]'::jsonb, false, 2),
      (sid, 'Who is the site mainly for?', 'long_text', '[]'::jsonb, false, 3),
      (sid, 'Share 2–3 websites you like and what you like about them.', 'long_text', '[]'::jsonb, false, 4);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Pages and content', 2, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Which pages do you think you need?', 'checkbox_list', '["Home","About","Services","Contact","FAQ","Blog","Shop","Other"]'::jsonb, false, 1),
      (sid, 'Do you have the written content for each page, or do you need copywriting?', 'single_choice', '["I have it","I need copywriting","Some of each"]'::jsonb, false, 2),
      (sid, 'Do you have photos and videos of your business, team, or products, or do you need photography?', 'single_choice', '["I have them","I need photography","Some of each"]'::jsonb, false, 3),
      (sid, 'Do you have a logo and brand colors, or do you need branding first?', 'single_choice', '["I have them","I need branding"]'::jsonb, false, 4);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Features', 3, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Which features do you need?', 'checkbox_list', '["Contact form","Custom forms (applications, intake, quotes, file uploads)","Booking or scheduling","Online payments/donations/shop","Blog you can update yourself","Email newsletter signup","Animations or motion","Client or member login area","Integrations with tools you use"]'::jsonb, false, 1),
      (sid, 'Which tools should the site connect with? (CRM, email platform, POS, Google Calendar, etc.)', 'long_text', '[]'::jsonb, false, 2),
      (sid, 'Anything else you’ve seen on another site and want on yours?', 'long_text', '[]'::jsonb, false, 3);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Technical', 4, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Do you own a domain? Who’s it with?', 'short_text', '[]'::jsonb, false, 1),
      (sid, 'Do you need a professional email (you@yourbusiness.com)?', 'yes_no', '[]'::jsonb, false, 2),
      (sid, 'How should the site be built?', 'single_choice', '["Custom-coded","WordPress","Wix","Squarespace","Recommend one for me"]'::jsonb, false, 3),
      (sid, 'After launch, will you update the site yourself or want us to maintain it on a care plan?', 'single_choice', '["Myself","Care plan","Not sure"]'::jsonb, false, 4),
      (sid, 'What city or area do you serve?', 'short_text', '[]'::jsonb, false, 5),
      (sid, 'Are you set up on Google Business Profile?', 'single_choice', '["Yes","No","Not sure"]'::jsonb, false, 6);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'App Development', 5, true, 'App Development — only if your project includes an app') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'In one sentence, what should the app do?', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'Who will use it?', 'checkbox_list', '["Customers","Staff","Admins","Other"]'::jsonb, false, 2),
      (sid, 'Which platforms?', 'checkbox_list', '["iPhone","Android","Web"]'::jsonb, false, 3),
      (sid, 'What are the must-have features for version one?', 'long_text', '[]'::jsonb, false, 4),
      (sid, 'What features can wait until a later version?', 'long_text', '[]'::jsonb, false, 5),
      (sid, 'Will users need accounts or logins? What’s different for each type of user?', 'long_text', '[]'::jsonb, false, 6),
      (sid, 'Will the app take payments, subscriptions, or payouts to other people?', 'long_text', '[]'::jsonb, false, 7),
      (sid, 'Do you need push notifications, texts, or emails sent from the app?', 'long_text', '[]'::jsonb, false, 8),
      (sid, 'Does it need to work offline?', 'yes_no', '[]'::jsonb, false, 9),
      (sid, 'Will it use location, the camera, photo uploads, or messaging?', 'checkbox_list', '["Location","Camera","Photo uploads","Messaging","None"]'::jsonb, false, 10),
      (sid, 'Do you need an admin dashboard to manage users, content, or orders?', 'yes_no', '[]'::jsonb, false, 11),
      (sid, 'Will it store sensitive information (health, financial, personal records, info about minors)?', 'long_text', '[]'::jsonb, false, 12),
      (sid, 'Does it need to connect with other systems or tools you use?', 'long_text', '[]'::jsonb, false, 13),
      (sid, 'Are there apps you like or that do something similar? What do you like or dislike about them?', 'long_text', '[]'::jsonb, false, 14),
      (sid, 'Do you have Apple Developer and Google Play accounts?', 'single_choice', '["Yes","No","Need help setting up"]'::jsonb, false, 15),
      (sid, 'Do you have a launch date or investor/funding milestone tied to this?', 'long_text', '[]'::jsonb, false, 16),
      (sid, 'Who will own and manage the app after launch?', 'long_text', '[]'::jsonb, false, 17);
  end if;
  qid := null;
  -- Social Media
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('social-media', 'Social Media', 'Your accounts, goals, content and how we’ll work together.', 'social_media', 4)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Your accounts', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Which platforms should we manage? Share handles for each.', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'Can you give us access, or add us as a collaborator/manager?', 'yes_no', '[]'::jsonb, false, 2),
      (sid, 'What’s working on your social right now, and what isn’t?', 'long_text', '[]'::jsonb, false, 3),
      (sid, 'About how often do you post now?', 'short_text', '[]'::jsonb, false, 4);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Goals and audience', 2, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'What do you want social media to do for you?', 'checkbox_list', '["More customers","Bookings","Event turnout","Awareness","Community","Other"]'::jsonb, false, 1),
      (sid, 'Who are you trying to reach?', 'long_text', '[]'::jsonb, false, 2),
      (sid, 'Share 2–3 accounts you love and what you like about them.', 'long_text', '[]'::jsonb, false, 3);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Content', 3, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Which kinds of posts do you want?', 'checkbox_list', '["Promos","Events","Behind the scenes","Tips","Testimonials","Reels/TikToks","Quotes","Other"]'::jsonb, false, 1),
      (sid, 'Do you have photos and videos we can use, or will you be sending new content regularly?', 'long_text', '[]'::jsonb, false, 2),
      (sid, 'Are you comfortable being on camera, or should content stay brand-focused?', 'single_choice', '["On camera","Brand-focused","Mix"]'::jsonb, false, 3),
      (sid, 'Are there launches, events, holidays, or seasons coming up that we should plan around?', 'long_text', '[]'::jsonb, false, 4),
      (sid, 'Are there topics, words, or styles we should avoid?', 'long_text', '[]'::jsonb, false, 5),
      (sid, 'How should your captions sound?', 'multi_choice', '["Fun","Professional","Inspirational","Straight to the point"]'::jsonb, false, 6),
      (sid, 'Do you have hashtags you already use?', 'long_text', '[]'::jsonb, false, 7);
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Process', 4, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'Who approves posts before they go live, and how quickly can they usually review?', 'long_text', '[]'::jsonb, false, 1),
      (sid, 'Should we reply to comments and DMs, or will you handle those?', 'single_choice', '["You handle them","I’ll handle them","Mix"]'::jsonb, false, 2),
      (sid, 'Do you want monthly analytics reports on growth and engagement?', 'yes_no', '[]'::jsonb, false, 3);
  end if;
  qid := null;
  -- UX/UI Design
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('ux-ui-design', 'UX/UI Design', 'What we’re designing, who it’s for, and what you need at the end.', 'ux_ui', 5)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'UX/UI Design', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'What are we designing?', 'single_choice', '["Website","App","Both"]'::jsonb, false, 1),
      (sid, 'What problem does it solve for the people using it?', 'long_text', '[]'::jsonb, false, 2),
      (sid, 'Who are the users? Describe them and how comfortable they are with tech.', 'long_text', '[]'::jsonb, false, 3),
      (sid, 'Walk us through the main thing a user needs to do, step by step.', 'long_text', '[]'::jsonb, false, 4),
      (sid, 'Do you have sketches, wireframes, or notes already? Upload them here.', 'file_upload', '[]'::jsonb, false, 5),
      (sid, 'Share apps or sites that feel the way you want yours to feel.', 'long_text', '[]'::jsonb, false, 6),
      (sid, 'Which devices matter most?', 'checkbox_list', '["Phone","Tablet","Desktop"]'::jsonb, false, 7),
      (sid, 'Do you have a brand guide, or should the design set the visual direction?', 'long_text', '[]'::jsonb, false, 8),
      (sid, 'Who’s building it after the designs are done?', 'single_choice', '["Thrive","Another developer","Not sure yet"]'::jsonb, false, 9),
      (sid, 'Which files do you need?', 'checkbox_list', '["Figma file","Mockups","Style guide","Developer handoff"]'::jsonb, false, 10),
      (sid, 'Are there accessibility needs we should design for?', 'long_text', '[]'::jsonb, false, 11),
      (sid, 'Have you gotten feedback from real users yet? If yes, what did they say?', 'long_text', '[]'::jsonb, false, 12);
  end if;
  qid := null;
  -- Photography
  insert into questionnaires (slug, title, description, service_type, sort_order)
    values ('photography', 'Photography', 'What the shoot is for, the look you want, and the details for the day.', 'photography', 6)
    on conflict (slug) do nothing returning id into qid;
  if qid is not null then
    insert into questionnaire_sections (questionnaire_id, title, sort_order, is_optional, optional_label)
      values (qid, 'Photography', 1, false, '') returning id into sid;
    insert into questionnaire_questions (section_id, prompt, type, options, is_required, sort_order) values
      (sid, 'What’s the shoot for?', 'checkbox_list', '["Website","Social","Brand launch","Products","Team headshots","Event","Other"]'::jsonb, false, 1),
      (sid, 'What or who needs to be photographed?', 'checkbox_list', '["People","Products","Space","Food","Process","Other"]'::jsonb, false, 2),
      (sid, 'How many people will be in the shoot?', 'short_text', '[]'::jsonb, false, 3),
      (sid, 'Where should it happen?', 'single_choice', '["Your location","Outdoors","Studio","Multiple spots"]'::jsonb, false, 4),
      (sid, 'Do you have dates or times that work best? Is there a time your space looks its best?', 'long_text', '[]'::jsonb, false, 5),
      (sid, 'Share any photos or accounts with the style you like.', 'long_text', '[]'::jsonb, false, 6),
      (sid, 'Upload reference photos', 'file_upload', '[]'::jsonb, false, 7),
      (sid, 'What mood are you going for?', 'multi_choice', '["Bright and airy","Bold and colorful","Moody","Candid","Polished"]'::jsonb, false, 8),
      (sid, 'Are there must-have shots on your list?', 'long_text', '[]'::jsonb, false, 9),
      (sid, 'Will you handle wardrobe, props, and styling, or need guidance?', 'single_choice', '["I’ll handle it","I need guidance"]'::jsonb, false, 10),
      (sid, 'Where will the photos be used, and do you need specific sizes?', 'long_text', '[]'::jsonb, false, 11),
      (sid, 'Do you need help with releases from anyone in the shoot?', 'yes_no', '[]'::jsonb, false, 12),
      (sid, 'Is there anything we should know about the space, parking, or access on the day?', 'long_text', '[]'::jsonb, false, 13);
  end if;
  qid := null;
end $$;
