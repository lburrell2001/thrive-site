# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

There is no test suite.

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Server-only (contact form API route, admin actions)
RESEND_API_KEY=                  # Email notifications
CONTACT_NOTIFY_TO=               # Email address to receive inquiries
CONTACT_NOTIFY_FROM=             # Verified Resend sender address
STRIPE_SECRET_KEY=               # Stripe Checkout for invoice payments
STRIPE_WEBHOOK_SECRET=           # Stripe webhook signature verification
CRON_SECRET=                     # Bearer token Vercel Cron sends to /api/portal/admin/generate-invoices, /api/cron/weekly-digest and /api/cron/scheduled-emails
PORTAL_CREDENTIALS_KEY=          # 32 random bytes, base64 (`openssl rand -base64 32`) — AES-256-GCM key for the client credentials vault
TWILIO_ACCOUNT_SID=              # Text messages (optional — texts are simply off without these)
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=    # Preferred; or TWILIO_FROM_NUMBER=+1... for testing
CONTACT_NOTIFY_PHONE=            # Lauren's mobile, for texts on signings, declines and new inquiries
GSC_SERVICE_ACCOUNT_JSON=        # Search Console (optional): the Google service account's JSON key, pasted whole
GSC_SITE_URL=                    # e.g. sc-domain:thrivecreativestudios.org — the service account must be a user on this property
ANALYTICS_SALT=                  # Optional key for the daily visitor hash; falls back to the service role key
NEXT_PUBLIC_GOOGLE_REVIEW_URL=   # Optional: Google Business Profile "write a review" link, offered after a client submits a review
RESEND_INBOUND_DOMAIN=           # Optional: Resend receiving domain (e.g. mail.thrivecreativestudios.org). Set → emails get signed reply-… Reply-To addresses
RESEND_WEBHOOK_SECRET=           # Signing secret of the Resend webhook for `email.received` → POST /api/email/inbound
```

`PORTAL_CREDENTIALS_KEY` must never change once clients have saved credentials — rotating it makes existing entries undecryptable.

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase, Resend, Vercel Analytics. React Compiler is enabled (`reactCompiler: true` in `next.config.ts`).

**Routing:** All pages live under `src/app/` using the App Router file convention. Service sub-pages are static (`/services/branding`, `/services/web-ux`, etc.). Work pages are dynamic (`/work/[slug]`), fetched server-side from Supabase.

### Supabase — two clients

| File | Key used | When to use |
|------|----------|-------------|
| `src/lib/supabaseServer.ts` | Anon key (public) | Server Components reading `projects` table / storage |
| `src/lib/supabaseService.ts` | Service role key | API routes that write data (e.g. `contact_inquiries`) |

Both are lazy Proxy objects that throw at call time (not import time) if env vars are missing.

### Storage

All media lives in the Supabase `course-media` bucket:

- `projects/{slug}/cover.jpg` — project cover image
- `projects/{slug}/gallery/{file}` — gallery images (listed dynamically)
- `videos/webux.mp4` — homepage featured case study video

Helpers in `src/lib/storage.ts` (`projectCover`, `projectGallery`, `storageUrl`) build public URLs directly from the env var without calling the Supabase client.

### Projects data

Projects are sourced **from Supabase** (`projects` table) at runtime. `src/app/work/projects.ts` contains a `WORK_PROJECTS` static array that predates the Supabase integration — it is the reference for project slugs and metadata but is not currently rendered anywhere; the live site reads from the database.

The `projects` table columns used by the app: `id`, `title`, `slug`, `category`, `span`, `tagline`, `overview`, `description`, `role`, `year`, `tools` (array), `website_url`, `repo_url`, `problem`, `solution`, `results`, `project_notes`, `featured` (boolean).

### Contact form flow

`POST /api/contact` (`src/app/api/contact/route.ts`):
1. Writes to `contact_inquiries` table via `supabaseService` (primary — blocks on failure).
2. Sends HTML email via Resend (secondary — never blocks form submission if it fails).

### Credentials vault

Clients submit website host / CMS / registrar logins at `/portal/vault` instead of texting them.

- Table: `portal_credentials` (migration `011`). RLS is on with **no policies** — the anon key cannot read it at all.
- Passwords and notes are encrypted with AES-256-GCM in `src/lib/credentialCrypto.ts` before they are written, so the DB holds no plaintext.
- Every read/write goes through a server route with the service role key: `POST /api/portal/credentials` (client, Supabase bearer token; actions `list` / `reveal` / `create` / `update` / `delete`) and the `reveal_credential` / `delete_credential` actions on `/api/admin` (passcode).
- List responses carry metadata only (`has_secret`, `has_notes`) — a secret leaves the server only in response to an explicit `reveal`. Admin reveals stamp `last_viewed_at` / `last_viewed_by`, which the client sees in their vault.

### Reminders and text messages

- Admin sends reminders from the Remind buttons on unpaid invoices, unsigned proposals (uploaded and builder), unfinished onboarding, and "Message Client" on the profile. The logic is in `src/lib/reminders.ts`; routes are the `reminder_preview` / `send_reminder` actions on `/api/admin` and `GET`/`POST /api/proposals/[id]/remind`.
- Every email except newsletters (client notifications, proposal receipts/declines, bookings, and the internal alerts and weekly digest) shares the Thrive layout in `src/lib/emailLayout.ts` — black header with the white logo, white body, black footer with the logo mark, Bungee/Bai Jamjuree. Logos are PNGs in `public/email/` (email clients do not show SVG). The portal sign-in code email is a Supabase template: `supabase/templates/portal-code.html` is generated from the same layout and pasted into Supabase → Authentication → Emails.
- Every client email and text goes through `src/lib/clientNotify.ts`, which resolves a portal client or proposal recipient to one `Contact`. A text is sent only when the client has a phone **and** `sms_opt_in` is true. A Twilio STOP (error 21610) turns `sms_opt_in` off.
- Every reminder attempt is logged in `client_reminders` (migration `018`, RLS on with no policies).
- `portal_clients` writes from the browser are limited by column grants to `full_name, company_name, initials, phone, sms_opt_in`. Clients cannot change `role`.

### Admin home and weekly digest

`/admin` is the home page: follow-ups due, unread inquiries, proposals awaiting signature, unpaid invoices, the pipeline and this week's traffic, with Remind buttons and task checkboxes inline. The client list lives at `/admin/clients` (`?client=<id>` opens one).

- Both the home page (`GET /api/dashboard`) and the Monday digest read `buildAdminSummary()` in `src/lib/adminSummary.ts`, so they always agree. Days are Dallas days.
- The digest (`src/lib/weeklyDigest.ts`) emails `CONTACT_NOTIFY_TO` and texts `CONTACT_NOTIFY_PHONE` if set. Vercel Cron calls `GET /api/cron/weekly-digest` at 13:00 UTC Mondays with `Bearer CRON_SECRET`; "Send me the weekly digest" on the home page calls `POST /api/dashboard/digest`.

### CRM

`/admin/crm` is a workspace (`src/app/admin/crm/layout.tsx`): a sidebar of **Today** (`/admin/crm`: replies, follow-ups due, new inquiries, deals gone quiet — `loadToday()` / `GET /api/crm/today`), **Pipeline** (`/admin/crm/pipeline`, the deal board), **Prospects**, **Contacts** and **Emails**, plus ⌘K search (`CommandPalette.tsx`). The layout owns the contact panel (`ContactDrawer.tsx`: Overview / Activity / Details tabs) and shares `openContact`, a refresh `version`, the contact list and the toast through `useCrm()` (`CrmContext.tsx`). `?contact=<id>&deal=<id>` or `?portal=<id>` on any CRM URL opens someone — the dashboard, digest, booking and reply-forward emails link in that way. Old `/admin/crm/newsletters` and `/admin/crm/prospecting` URLs redirect (next.config.ts).

- `crm_contacts` (migration `019`) is the person; `crm_deals` (migration `021`) is one piece of work with them, carrying the stage, value and lost reason. A contact can have many deals, so a returning client's new project is its own card. RLS is on with no policies on both.
- One contact per person, whichever way they arrived. `contact_inquiries.crm_contact_id` and `proposal_clients.crm_contact_id` point at a contact; `crm_contacts.portal_client_id` links a portal login. Database triggers create or link the contact (matched on lowercased email) whenever one of those rows is inserted.
- Triggers also attach work to deals: an inquiry (`contact_inquiries.crm_deal_id`) or a new proposal (`proposals.crm_deal_id`) joins the contact's most recent open deal, or opens a new lead if they have none. Sent/viewed moves that deal to `proposal`, signed to `won`; a portal login wins the open deal. Stages never move backward on their own. Every stage change is logged to `crm_activities` with the deal id and title.
- Retainer deals (migration `033`): `monthly_cents`, `term_months`, `starts_on` (blank = the day it's won). A trigger keeps `value_cents` = monthly × months, so every total that reads `value_cents` counts the whole contract. Progress (month N of M, end date, still to come) and the pipeline's "Monthly retainers" stat come from `src/lib/retainer.ts`.
- Lifecycle shown everywhere (`lifecycleOf()` in `shared.ts`): Client (portal login or a won deal) → Lead (an open deal) → Prospect (`prospect_status = 'prospect'`) → Contact.
- Deleting and moving contacts (`POST /api/crm/contacts/bulk`, `src/lib/crmBulk.ts`; the panel's buttons and the Contacts/Prospects select bars via `contactActions.ts`): → Lead opens a New lead deal for anyone without an open one; → Prospect closes open deals as Lost ("Moved to Prospects") and sets `prospect_status`, and never moves clients; delete cascades to deals, notes and tasks.
- The contact timeline is assembled at read time in `src/lib/crmRepo.ts` from `crm_activities`, inquiries, `client_reminders`, builder proposals, uploaded proposals, invoices, emails sent (`prospect_emails`, `newsletter_sends`) and `email_replies`. It is not copied into one table.
- Routes: `/api/crm/deals` (+ `[id]`), `/api/crm/contacts` (+ `[id]`, `[id]/activities`, `[id]/tasks`, `[id]/portal`, `[id]/recipient`, `[id]/seen`), `/api/crm/tasks/[id]`, `/api/crm/activities/[id]`, `/api/crm/today`, `/api/crm/replies/[id]`, all gated by `requireAdmin`. "Quick message" uses the `crm_contact` reminder target, which can email anyone but texts only via a portal or proposal record that carries consent.

### Prospects and replies

Migration `030`. Prospects are people Lauren reaches out to before they've shown interest: `crm_contacts.prospect_status = 'prospect'`, no deal, listed at `/admin/crm/prospects` (`src/lib/prospectList.ts`, `GET/POST /api/prospects` — add one or a pasted list; existing contacts are never duplicated, and anyone with deals is left alone). Any new deal for a prospect converts them (`crm_convert_prospect` trigger → `'converted'`), so the board only holds people who engaged.

- Every email sent from the site to a contact has Reply-To `reply-<contact hex>-<hmac>@RESEND_INBOUND_DOMAIN` (`replyAddress()` in `newsletterTokens.ts`; falls back to `CONTACT_NOTIFY_TO` when unset).
- Resend receives the reply and calls `POST /api/email/inbound` (`email.received`, verified with `RESEND_WEBHOOK_SECRET`). `src/lib/inboundEmail.ts` fetches the full message, finds the contact (signed address first, then sender email), stores it once in `email_replies` (unique Resend id), strips the quoted original, stamps `replied_at`, opens a New lead deal for a prospect with no open deal (source `email reply`), adds a "Reply to …" task, and forwards the reply (attachments included) to `CONTACT_NOTIFY_TO` with Reply-To = the sender. Mail from `CONTACT_NOTIFY_FROM` itself is ignored.
- Setup status shows in Emails → Settings.

### Marketing campaigns

`/admin/crm/campaigns` compares every piece of marketing, print and email (migration `031`, `src/lib/marketing.ts`). Print campaigns (`marketing_campaigns`: piece, sent date, cost, short-link `code`, destination) have recipients (`marketing_recipients`, with a hand-marked `outcome`: sent / responded / lead / won / no_response — marking "lead" opens a deal, source `print`). Email campaigns are read from sent `newsletters` + `newsletter_sends`, and one-to-one `prospect_emails` show as one line; nothing is copied. Results count replies, deals opened and deals won within `RESULT_DAYS` (60) of the send.

- Each print campaign's QR code (generated in the browser with `qrcode`, downloadable as SVG/PNG) points at `SITE_URL/m/<code>`. `src/app/m/[code]/route.ts` logs a scan in `marketing_scans` (daily-rotating visitor hash, bots skipped) and redirects to the destination with `utm_source=print&utm_medium=<piece>&utm_campaign=<code>`; analytics classifies that as the `print` channel, and an inquiry from that visit carries `utm_campaign`, which the campaign counts. Unknown codes go to the homepage.
- Print pieces appear on each recipient's timeline (kind `print`).

### Site analytics

`/admin/analytics` reports first-party traffic from `site_pageviews` (migration `020`, RLS on with no policies). Vercel Analytics and GTM/Google Ads still run alongside it, but their data can't be read back into admin; this can, and it joins to the CRM.

- `src/app/components/SiteTracker.tsx` (mounted in the root layout, production only) posts page views to `POST /api/track`. No cookies: a session id in sessionStorage, the first-ever visit's source in localStorage. `/admin`, `/portal`, `/p/` and `/api` are never tracked, nor is any browser that has signed in to admin (`thrive_no_track` in localStorage).
- `/api/track` is public: it drops bots, caps every field, classifies the source server-side (`src/lib/trafficSource.ts`), and stores a daily-rotating HMAC of IP + user agent instead of the IP (`ANALYTICS_SALT` if set, else the service role key).
- The contact page (`src/app/contact/page.tsx` — `ContactForm.tsx` is unused) sends its session id and first-touch source; `/api/contact` stores `source`, `channel`, `landing_path`, `first_source` and `company` on the inquiry (`src/lib/inquiryAttribution.ts`). If those columns are missing it retries the insert without them, so the form never fails on extras. The route reads `projectType`/`message` and also accepts `service`/`description`.
- `src/lib/analyticsReport.ts` aggregates in TypeScript (days in America/Chicago); `src/lib/trafficInsights.ts` holds the rules behind "How to grow traffic". Won work is attributed through the inquiry's deal.
- Google Search Console (`src/lib/searchConsole.ts`) is optional: with `GSC_SERVICE_ACCOUNT_JSON` and `GSC_SITE_URL` set, the analytics page, suggestions and digest include search queries, clicks and positions. It signs a service-account JWT itself — no Google SDK. Without them, the panel shows setup steps.

### Service page SEO

- `src/lib/serviceSeo.ts` holds each service page's `<title>`, meta description and FAQs. FAQ answers only restate what the pages already say — keep them true; Google and AI assistants quote them.
- Titles lead with the service and the place ("Affordable Web Design in Dallas, TX"; the layout template adds " | Thrive Creative Studios"). Web, branding and social pages also render `ServiceAbout` (the `about` copy in `serviceSeo.ts`: what's included, who it's for). `/services/digital-design` is shown as "Web Design" but keeps its URL.
- `/amarillo-web-design` targets Amarillo (Lauren's hometown; remote, in person when she's in town). Her story goes in `HOMETOWN_STORY` in that page. Amarillo is also in the root `areaServed`.
- `ServiceFaq` renders the FAQ plus `Service`, `FAQPage` and `BreadcrumbList` JSON-LD; the root layout's `ProfessionalService` (`@id` = `BUSINESS_ID`) lists the services and DFW cities. Always serialize JSON-LD with `jsonLd()` from `src/lib/seo.ts`.
- The canonical host is `thrivecreativestudios.org` (Vercel 308-redirects www to it). `robots.txt` disallows `/admin`, `/portal`, `/api/`; `/p/` and `/review/` stay crawlable because they carry `noindex`.

### Journal

Articles at `/journal`, written at `/admin/journal` (migration `022`). Bodies are markdown rendered by `src/lib/articleMarkdown.tsx` as React elements — no raw HTML. Public reads use the anon key; RLS returns only published posts. Publishing/editing calls `revalidatePath` for the index, the article and the sitemap. The editor's search checklist is `src/lib/journalChecklist.ts`. Cover uploads are capped at 4 MB (Vercel's body limit is 4.5 MB).

### Reviews

Requested from a won deal in the CRM (`POST /api/reviews/request`), submitted at `/review/[token]`, approved at `/admin/reviews` (migration `023`). A DB check refuses `approved` without `consent_publish`; anon can read only approved rows and only the display columns (column grants — the token is never readable). Approved reviews show on service pages via `ServiceTestimonials`. There is deliberately no Review/AggregateRating markup: Google ignores self-serving review stars.

### Book a call

`/book` (migration `025`). Weekly hours, length, buffer, notice and days off are set at `/admin/calls`; slots are computed in `src/lib/bookingTime.ts` (pure, DST-safe) and re-checked on booking, with a unique index on confirmed `starts_at` as the race guard. A booking also inserts a `contact_inquiries` row, so the CRM triggers create the contact/deal as for the contact form, and adds a CRM task on the call day. Both sides get an email with an `.ics` invite; `/book/[token]` cancels. No calendar sync — availability is the configured hours only.

### Emails (newsletters and outreach)

Newsletters and prospect emails are one thing: an email designed once and sent to an audience. They live in the `newsletters` table (name kept) and are written at `/admin/crm/emails/[id]`; templates for both are `email_templates` (migration `030` renamed `prospect_templates` and folded `newsletter_templates` in), edited at `/admin/crm/emails/templates/[id]`, served by `/api/emails/templates`. Rendering for every email is `renderEmail()` in `src/lib/emailContent.ts`: style `personal` (looks typed, logo signature), `designed` (sections), or null for older markdown/imported ones; `{{first_name}}` / `{{company}}` fill per person and `[[…]]` placeholders block sending. The footer line comes from `REASON` — subscriber audiences get the newsletter line, outreach audiences (`OUTREACH`: `prospects`, `prospect_tag`, `contacts` hand-picked via `audience_contact_ids`) get the outreach line. Subscriber audiences reach only `subscribed`; outreach audiences reach anyone with an email who hasn't unsubscribed.

#### Subscriptions

Subscription lives on the CRM contact (`crm_contacts.newsletter_status`, migration `026`): `pending` → `subscribed` → `unsubscribed`, or null for never asked. Only `subscribed` contacts are ever emailed.

- The footer signup (`NewsletterSignup` → `POST /api/newsletter/subscribe`) is double opt-in: it emails a confirm link (`/newsletter/confirm/[token]`), throttled to one per 10 minutes per address, and always answers the same way so it can't reveal who is subscribed. Admin can subscribe a contact from their CRM drawer only with a note of how they agreed.
- Confirm and unsubscribe links are HMAC-signed tokens (`src/lib/newsletterTokens.ts`) bound to purpose. Unsubscribe is POST-only (`/api/newsletter/unsubscribe?t=`, also the RFC 8058 one-click target in the `List-Unsubscribe` header) so link scanners can't unsubscribe anyone; the `/newsletter/unsubscribe/[token]` page just has the button.
- Older newsletters were written in the journal's markdown (`body`), rendered to inline-styled email HTML by `src/lib/newsletterEmail.ts` (pure — the editor preview uses it too). Sending (`src/lib/newsletter.ts`) claims the row (`draft|failed` → `sending`) so it can't double-send, batches 100 per Resend call with an idempotency key, and records every recipient in `newsletter_sends` (unique per newsletter+contact) so a failed send resumes with only the people it missed.
- Sending is refused until a mailing address is saved (`admin_config` key `newsletter_postal_address`) — CAN-SPAM requires one in every marketing email.
- Designed newsletters (migration `027`) are a stack of sections (`src/lib/newsletterBlocks.ts`): agency sections — logo bar, hero, project grid, numbers, services list, testimonial, call to action, footer — plus basics (image, heading, text, button, image + text, divider, spacer, social). Every block has an optional `bg` and `pad`; `src/lib/emailSections.ts` renders them as table-based HTML that stacks on phones and picks text/link/button colours against each band's background (`toneFor`). Blocks saved before `bg`/`pad` existed keep their old spacing; always read stored blocks through `normalizeBlocks()`. The design adds `corners`, `uppercase` and `theme`; `THEMES` (Studio, Midnight, Pop, Editorial) set the design and the bands' colours. When `blocks` is non-empty it renders instead of `body`. Images are uploaded to the public `course-media` bucket under `newsletters/`. Sending refuses any section image without a file or alt text (`blockImages()`). `newsletter_templates` stores a layout + design to start from.
- The designer (`src/app/admin/email-designer/`) is used by both the newsletter and prospect template editors: sections and layers on the left, the email in an iframe in the middle, settings on the right. The canvas is `renderSections` with `editing: true` (data-block / data-field / data-img / data-opt attributes, never in sent mail) written into an unsandboxed iframe; typing into it updates blocks without rewriting the iframe, everything else rewrites it. Undo/redo, drag-to-reorder, drop-an-image-to-upload and a phone preview live there.
- Canva designs (migration `028`): Canva Email's "HTML and images" .zip (or an .html file) is uploaded to `POST /api/newsletters/[id]/import`. `src/lib/newsletterImport.ts` re-hosts every image (zip files, and remote https images on public hosts only — no redirects, no private/metadata addresses) under `newsletters/imports/`, then sanitizes with `sanitize-html` (tables, inline styles and `<style>` kept; scripts, forms, iframes, SVG and event handlers removed; links http(s)/mailto/tel; only Google Fonts stylesheets). The stored `html` wins over blocks and body; preheader, `{{first_name}}` and the unsubscribe/address footer are applied at send time.

#### Scheduling and drafts

Migration `032`. An audience email can be scheduled (`status = 'scheduled'`, `scheduled_at`; `POST`/`DELETE /api/newsletters/[id]/schedule`) and stays editable until it sends; the editor autosaves drafts. One-to-one emails keep one draft per contact in `prospect_drafts` (saved on closing the Email dialog, optionally scheduled; `/api/emails/drafts`), deleted once sent. Vercel Cron calls `GET /api/cron/scheduled-emails` every 5 minutes (`src/lib/scheduledEmails.ts`), which claims each due row before sending, works out the audience at send time, and emails `CONTACT_NOTIFY_TO` if anything fails. Scheduling runs every send check up front. Time helpers are in `src/lib/scheduleTime.ts`.

### One-to-one emails

The **Email** button on a contact (`EmailDialog.tsx` → `POST /api/emails/send`, `src/lib/prospects.ts`) sends one template, edited for that person, to one contact — a prospect or anyone else — and records it in `prospect_emails` (migration `029`). Same unsubscribe link, List-Unsubscribe headers, mailing address and signed Reply-To as every other email; sending is refused once a contact is `unsubscribed`, and a `lead` deal moves to `contacted`.

### Styling

Global design tokens (CSS custom properties) are defined in `src/app/globals.css` under the `:root` block — brand palette, spacing, typography. Page-level scoped styles use CSS Modules (e.g. `WorkPage.module.css`, `ProjectPage.module.css`). Tailwind utility classes are used inline for layout/spacing throughout.

### SEO

`src/lib/seo.ts` exports `buildPageMetadata()` for generating consistent `Metadata` objects on static pages. Dynamic pages (`/work/[slug]`) build metadata manually from Supabase data. JSON-LD structured data is injected as inline `<script>` tags in both the root layout and project pages.
