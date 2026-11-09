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
OPINLY_API_KEY=                  # Opinly secret key (sk-…): /blog content and server-side conversion events. Never commit it
OPINLY_WEBHOOK_SIGNING_SECRET=   # Svix signing secret of the Opinly webhook (content.routes-changed → POST /api/opinly)
MS_TENANT_ID=                    # Outlook (optional): Microsoft Entra app registration in Lauren's tenant —
MS_CLIENT_ID=                    #   redirect URI https://thrivecreativestudios.org/api/outlook/callback,
MS_CLIENT_SECRET=                #   delegated Mail.Read, Mail.Send, Mail.Read.Shared, Mail.Send.Shared, Calendars.Read, offline_access, User.Read
GOOGLE_VOICE_NUMBER=             # Optional: Lauren's Google Voice number, so it's never read as the caller
```

`PORTAL_CREDENTIALS_KEY` must never change once clients have saved credentials — rotating it makes existing entries undecryptable.

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase, Resend, Vercel Analytics. React Compiler is enabled (`reactCompiler: true` in `next.config.ts`).

**Routing:** All pages live under `src/app/` using the App Router file convention. Service sub-pages are static (`/services/branding`, `/services/web-ux`, etc.). Work pages are dynamic (`/work/[slug]`), fetched server-side from Supabase.

### Front end (Nov 2026 redesign)

The public site's design lives in `src/app/_site/` (a private folder, not a route), after the TURNSTUDIO reference. Rules from Lauren: **only brand colours** (magenta `#e50586`, orange `#fd6100`, blue `#3943b7`, green `#0cf574`, purple `#9409ce`, black, white — no pastels, cream or sky blue); **Poppins only** (Bold −100 tracking for big headings, −85 for smaller ones, Medium −75 for all regular text, word-spacing added back; loaded in the root layout as `--rd-sans`); the real logo / logo mark, never the name typed out; straight layouts rather than tilted cards in sections like How We Work; no small labels above headings.

- `Shell.tsx` is the frame on every public page: pill buttons and logo up top, a full-screen menu of brand-colour panels, footer with the newsletter signup ("Join our community"). Redesigned pages render `<Shell>` directly; everything else goes through `PublicLayout`, which is now `<Shell legacy>` — the new frame with the page's old type kept inside (`.legacyBody`).
- Redesigned so far: home (`Home.tsx`; `/`), portfolio (`work/WorkIndex.tsx`; `/portfolio` — a packed mosaic built from 6×2 blocks, see `mosaic()`), project pages (`work/ProjectView.tsx`; `/work/[slug]` for every project with a case study — projects without one still get the old layout), the five service pages (`services/ServicePage.tsx` + `ServiceView.tsx`, per-service copy in `services/configs.ts`, taken from the old pages' wording) contact (`contact/ContactView.tsx`, same `/api/contact` payload), About (`about/AboutView.tsx`) and the Services overview (`services/ServicesIndex.tsx`, a brand-colour panel per service from `serviceShowcase.ts` + `servicePricing.ts`). Journal, Blog, Amarillo, Book, Privacy/SMS, newsletter confirm/unsubscribe and review pages keep their markup but are restyled in their own CSS modules on the same rules (render `<Shell>`). Only `/work/[slug]` for a project without a case study still uses `PublicLayout` (legacy). The menu is a grid of six brand-colour cards; the footer has Client portal and a small Admin button.
- Shared pieces: `redesign.module.css` (tokens, brand-colour classes `bMagenta`…, `display`, pills, `rise` fade-ins via `useReveal`), `CtaBand.tsx` (the magenta closing band), `ThriveIcons.tsx` (line icons; Brand is the logo mark). `links.ts` `rd()` is identity now (it kept links inside the `/redesign` preview while staged; `/redesign/*` redirects to the real pages).
- The homepage photos are chosen in admin, Website → Homepage (`/admin/homepage`, `src/lib/homeCollage.ts`, `admin_config` key `home_collage` = `{ mosaic: { desktop: [{slug, src, col, row, w, h}], phone: [...] }, fan: [×3], inline: [×2], pages }`; older saves — a plain array of seven picks, then `tiles` with named sizes — still read, packed onto desktop with a phone layout derived by `phoneFrom()`). The hero mosaic has separate desktop (6 columns) and phone (2 columns) layouts, up to 20 tiles each, every tile placed and sized freely: `MosaicEditor.tsx` drags tiles to any cell, resizes from the corner, swaps same-size tiles, adds a tile from an empty cell, arrow keys move/Shift+arrows resize; "Copy from desktop" rebuilds the phone layout. Placement rules (`canPlace`, no overlaps, max 4 rows tall) are in `src/lib/collageLayout.ts`, shared with the homepage, which renders both mosaics and shows one per breakpoint. `fan` is the three photos above the statement, `inline` the two in the services heading; null = automatic (`autoPhotos()`: projects not in the mosaic). `pages` (`about` 5, `contact` 3, `book` 4) are the photo strips on those pages (`loadStripPhotos()`; null = `mixedPhotos()`); `/book` is a server page around the client `BookView.tsx` so it can read them. Saving revalidates `/`, `/about`, `/contact`, `/book`, which also rebuild every 5 minutes. Only case-study images can be picked.

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
- Every read/write goes through a server route with the service role key: `POST /api/portal/credentials` (client, Supabase bearer token; actions `list` / `reveal` / `create` / `update` / `delete`) and the `save_credential` / `reveal_credential` / `delete_credential` actions on `/api/admin` (passcode). `save_credential` is for logins a client gave Lauren another way (text, call); they show in the client's vault too, and a blank password or notes on an edit keeps the stored one.
- List responses carry metadata only (`has_secret`, `has_notes`) — a secret leaves the server only in response to an explicit `reveal`. Admin reveals stamp `last_viewed_at` / `last_viewed_by`, which the client sees in their vault.

### Portal welcome

`/portal/welcome` (`src/app/portal/(app)/welcome/`): a full-screen, step-by-step setup like a new phone's, in the site's look (Poppins, brand colours, black pills) — Welcome (logo-mark petals fanning out, first name in magenta) → your name and business → text updates (phone + the exact `SmsOptInLabel` consent, never pre-checked; "Not now") → the portal at a glance (four brand-colour tiles) → assigned questionnaires (only if any are open) → all set (start the first questionnaire or go to the dashboard). Saves to the client's own `portal_clients` row (columns Settings may change) and marks it done on their auth `user_metadata.portal_welcome_done`; "Skip setup" finishes it at once. The portal layout sends anyone who `needsWelcome()` (`src/lib/portalWelcome.ts`) there and renders it without the sidebar: accounts created on/after `WELCOME_SINCE` (2026-11-08) that haven't finished, or anyone whose `portal_welcome` is `'pending'` — set by "Show welcome again" on the admin Client tab (`reset_welcome` action on `/api/admin`). No migration. The flow is `WelcomeFlow.tsx`; with a `preview` prop it saves nothing and loops back to the start — that's `/admin/welcome-preview` (⌘K "Portal welcome", or "Preview welcome" on a client's Profile tab, which passes `?client=&name=&company=` to use their name and open questionnaires).

### Service questionnaires

Migration `046`. Onboarding questionnaires clients fill out in the portal. Shared types/rules: `src/lib/questionnaires.ts` (pure); all reads and writes: `src/lib/questionnaireRepo.ts`. Tables `questionnaires` → `questionnaire_sections` (`is_optional` + `optional_label`) → `questionnaire_questions` (types short_text, long_text, single_choice, multi_choice, checkbox_list, yes_no, url, date, file_upload; `options` jsonb); `client_questionnaires` (assignment: `client_id`, optional `project_id`, `include_optional_sections` jsonb of section ids, status not_started → in_progress → submitted ⇄ reopened); `questionnaire_answers` (unique per assignment + question, `value` jsonb, `question_prompt_snapshot` = the wording the client saw). RLS on with **no policies** (vault pattern): only server routes read them. 046 seeds About You, Branding, Website Development (optional App Development section), Social Media, UX/UI Design, Photography; re-running skips existing slugs.

- Admin: Clients → **Questionnaires** (`/admin/questionnaires`: list, active switch, create, duplicate, delete/archive; `/admin/questionnaires/[id]`: editor with drag or ↑/↓ for sections and questions, move a question between sections, options editor, live client preview via the shared `src/components/questionnaire/QuestionField.tsx`; one explicit Save, `PUT /api/admin/questionnaires/[id]`). Removing a question/section/questionnaire that has answers archives it (`is_archived`); otherwise it's deleted. `questionnaire_answers.question_id` is `on delete restrict` as the backstop.
- Assigning: the Client tab's Profile → Questionnaires card (`src/app/admin/clients/QuestionnairesSection.tsx`, `POST /api/admin/questionnaires/assignments`); About You pre-checked, optional sections switched on per client (also later, per assignment), optional project, emails the client (`deliver()`, text if opted in). Remind uses the `questionnaire` reminder target. Home lists "Questionnaires waiting" (`GET /api/admin/questionnaires/assignments`).
- Responses: `/admin/questionnaires/responses/[id]` — grouped by section, snapshot wording with a note when the question has been edited since, archived questions still shown, Reopen, Export PDF (`src/lib/questionnairePDF.ts`, jspdf), Copy as text (`responsesText()`).
- Client: `/portal/onboarding` (now in the portal sidebar) lists assignments with progress above the old onboarding steps; `/portal/onboarding/[id]` is one section at a time with a section list, autosave (text 800 ms after typing, choices at once; "Saved"), required check before submit, confirm, thank-you, then read-only until reopened. Routes: `GET /api/portal/questionnaires`, `GET/POST /api/portal/questionnaires/[id]` (actions `answer`, `upload_url`, `attach`, `remove_file`, `submit`), authenticated by `requirePortalClient()` (`src/lib/portalAuth.ts`); browser helper `src/lib/portalApi.ts`.
- Files: the browser gets a signed upload URL and uploads straight to the private `client-documents` bucket at `questionnaires/<client>/<assignment>/<question>/…` (10 MB, images/PDF/Office/text; no 4.5 MB Vercel limit), then `attach` checks the object exists and adds `{ path, name, size, type }` to the answer's value list. Reads hand out 1-hour signed links. Removing an assignment deletes its files.
- Submitting emails `CONTACT_NOTIFY_TO` (falls back to hello@) with a link to the responses.

### Invoices and estimates

`/admin/invoices` (migration `039`) builds both from a typed list, one item per line, parsed by `src/lib/lineItems.ts` (pure; `Item | description | $price`, optional hours, `3h @ $100` multiplies, `-` lines extend the description above, `Included`, negative discounts, tab-separated paste). Invoices go into `portal_invoices` through the `add_invoice` action on `/api/admin`, which now takes `line_items` + `notes` and sets `amount_cents` from the lines, so the portal, Stripe, reminders and CRM deal triggers are unchanged; only portal clients can be invoiced (anyone can get a PDF). Estimates live in `estimates` (RLS on, no policies; `EST-001…`; `GET/POST /api/estimates`, `PATCH/DELETE /api/estimates/[id]`) and "Turn into invoice" marks them `invoiced`. `src/lib/invoicePDF.ts` prints the lines (older invoices print as one line), notes, and an ESTIMATE variant.

### Reminders and text messages

- Admin sends reminders from the Remind buttons on unpaid invoices, unsigned proposals (uploaded and builder), unfinished onboarding, and "Message Client" on the profile. The logic is in `src/lib/reminders.ts`; routes are the `reminder_preview` / `send_reminder` actions on `/api/admin` and `GET`/`POST /api/proposals/[id]/remind`.
- Every email except newsletters (client notifications, proposal receipts/declines, bookings, and the internal alerts and weekly digest) shares the Thrive layout in `src/lib/emailLayout.ts` — black header with the white logo, white body, black footer with the logo mark, Bungee/Bai Jamjuree. Logos are PNGs in `public/email/` (email clients do not show SVG). The portal sign-in code is sent by the site, not Supabase: `POST /api/portal/auth/send-otp` gets the code from `admin.generateLink` (`email_otp`, which sends nothing), emails it in the Thrive layout and texts it when the client has a phone and `sms_opt_in`; one code per address per minute (`app_metadata.portal_code_sent_at`). The browser verifies with `verifyOtp({ type: 'email' })`. `supabase/templates/portal-code.html` is now only used if something else triggers a Supabase OTP email.
- Every client email and text goes through `src/lib/clientNotify.ts`, which resolves a portal client or proposal recipient to one `Contact`. A text is sent only when the client has a phone **and** `sms_opt_in` is true. A Twilio STOP (error 21610) turns `sms_opt_in` off.
- Every reminder attempt is logged in `client_reminders` (migration `018`, RLS on with no policies).
- `portal_clients` writes from the browser are limited by column grants to `full_name, company_name, initials, phone, sms_opt_in`. Clients cannot change `role`.

### Admin shell

One app (2026-11-04). After sign-in, `AdminShell.tsx` renders `AdminWorkspace.tsx`: one black sidebar for every admin page (Home · Sales: Pipeline, Prospects, Contacts, Proposals, Estimates & invoices · Clients · Outreach: Emails, Campaigns, Calls · Website: Analytics, Journal, Portfolio, Services, Reviews · Settings), ⌘K search (`crm/CommandPalette.tsx`, people and every page) and the contact panel. The workspace provides `useCrm()` to every admin page, so any page can `openContact(id, deal)`; `?contact=<id>&deal=<id>` or `?portal=<id>` on any admin URL opens someone. The proposal builder/preview/tuner are full-screen (no sidebar).

- Design tokens (`--a-bg`, `--a-border`, `--a-accent`, `--a-display`, `--a-track`…) are set on the shell in `src/app/admin/admin.module.css`; `proposals/proposals.module.css` (basics: buttons, inputs, cards, lists) and `crm/workspace.module.css` (page frame, stats, cards, items, tables, pills, tabs) read them. Since 2026-11-08 the admin follows the public site's look: Poppins only (titles Bold −100, smaller headings −85, text Medium −75 via `--a-track` on the page frames, sidebar, drawer and dialogs — not the shell, so the proposal builder's preview keeps its own spacing), brand colours only (no pastels: status pills/badges are solid magenta/orange/blue/green/purple/black with contrasting text), white work area, black sidebar, black pill buttons that turn magenta, 22px cards, Title Case (no all-caps labels). The shell points `--font-inter` / `--font-bungee` at Poppins so older inline styles follow. The invoice paper preview keeps its printed-invoice caps. New admin pages use `w.page` / `w.head` / `w.title` and these classes rather than inline styles. Line icons: `AdminIcon.tsx`.
- Merged 2026-11-04 (old URLs redirect in next.config.ts, query kept): CRM Today → Home (`/admin/crm` → `/admin`); the bookings page → Calls (`/admin/calls` → `/admin/crm/calls`, which also cancels bookings); Visitors → Analytics tab (`/admin/analytics?tab=visitors`); booking hours, email settings and security → `/admin/settings` (tabs `email`, `booking`, `security`; components in `src/app/admin/settings/`).
- Clients (phase 2, 2026-11-04): a portal client's work (profile, requests, vault, proposals, onboarding, projects with their invoices, files, milestones and requests) is the **Client** tab of the contact panel — `ClientPortal` in `src/app/admin/clients/ClientPortal.tsx`, through the `/api/admin` actions; the panel widens on that tab. `/admin/clients` is just the list of portal logins plus New client; a row, `/admin/clients?client=<portal id>`, `?portal=<id>` or `openContact(id, null, 'client')` (URL `&panel=client`) opens the panel there. Portal clients with no CRM contact open inline on the list page. In a project, "+ Invoice" / "+ Estimate" open `/admin/invoices?mode=&client=<portal id>&project=<name>` (the builder starts a draft for that client with the project as its title, so the invoice joins the project's deal; "← Back to client" returns), and "+ New proposal" gets the client's proposal recipient (`proposal_recipient` action on `/api/admin`, created if missing) and opens `/admin/crm/proposals/new?client=&title=&deal=`. Uploading a PDF proposal is still offered under it; quick-adding an invoice inline is gone (make one recurring with its ↻ Recurring button).
- Portfolio and Services use the shared styles too (light, `w.page`/`w.card`).

### Admin home and weekly digest

`/admin` is Home: replies to answer, follow-ups, new inquiries, upcoming calls, proposals awaiting signature and unpaid invoices (with Remind), deals gone quiet, reviews, the pipeline and this week's traffic. People open in the contact panel. It reads `GET /api/dashboard` and `GET /api/crm/today`.

- Both the home page (`GET /api/dashboard`) and the Monday digest read `buildAdminSummary()` in `src/lib/adminSummary.ts`, so they always agree. Days are Dallas days.
- The digest (`src/lib/weeklyDigest.ts`) emails `CONTACT_NOTIFY_TO` and texts `CONTACT_NOTIFY_PHONE` if set. Vercel Cron calls `GET /api/cron/weekly-digest` at 13:00 UTC Mondays with `Bearer CRON_SECRET`; "Send me the weekly digest" on the home page calls `POST /api/dashboard/digest`.

### CRM

The CRM pages live under `/admin/crm/*`: **Pipeline** (the deal board), **Prospects**, **Contacts**, **Calls**, **Emails**, **Campaigns**, **Proposals**. Today's feed (`loadToday()` / `GET /api/crm/today`: replies, follow-ups due, new inquiries, deals gone quiet) shows on Home. The admin workspace (see Admin shell) owns the contact panel (`ContactDrawer.tsx`: Overview / Activity / Details tabs) and shares `openContact`, a refresh `version`, the contact list and the toast through `useCrm()` (`CrmContext.tsx`). The dashboard, digest, booking and reply emails link in with `/admin?contact=…`. Old `/admin/crm/newsletters` and `/admin/crm/prospecting` URLs redirect (next.config.ts).

- `crm_contacts` (migration `019`) is the person (`job_title`, migration `042`, is their role — "Owner" — set in the panel's Details, when adding a prospect or in New deal; only written when filled, so saves work before 042); `crm_deals` (migration `021`) is one piece of work with them, carrying the stage, value and lost reason. A contact can have many deals, so a returning client's new project is its own card. RLS is on with no policies on both.
- One contact per person, whichever way they arrived. `contact_inquiries.crm_contact_id` and `proposal_clients.crm_contact_id` point at a contact; `crm_contacts.portal_client_id` links a portal login. Database triggers create or link the contact (matched on lowercased email) whenever one of those rows is inserted.
- Triggers also attach work to deals: an inquiry (`contact_inquiries.crm_deal_id`) or a new proposal (`proposals.crm_deal_id`) joins the contact's most recent open deal, or opens a new lead if they have none. Sent/viewed moves that deal to `proposal`, signed to `won`. Stages never move backward on their own. Every stage change is logged to `crm_activities` with the deal id and title.
- The Clients tab drives deals too (migration `036`): a project, uploaded proposal or invoice added for a portal client joins their open deal (or opens one, source `portal`) and moves it to `proposal`; `portal_projects` / `portal_proposals` / `portal_invoices` carry `crm_deal_id` (an uploaded proposal takes its project's deal, an invoice the deal of the project with the same name, or the latest won deal when nothing is open). An invoice turning `paid` (Stripe or by hand) wins its deal. A portal login alone only links the contact — it no longer wins anything. The panel lists that work under its deal.
- Retainer deals (migration `033`): `monthly_cents`, `term_months`, `starts_on` (blank = the day it's won). A trigger keeps `value_cents` = monthly × months, so every total that reads `value_cents` counts the whole contract. Progress (month N of M, end date, still to come) and the pipeline's "Monthly retainers" stat come from `src/lib/retainer.ts`.
- Closing finished work (migration `045`, `src/lib/dealClose.ts`): the pipeline is for leads, open deals and won work still running. `crm_deals.closed_at` / `closed_reason` (`retainer_ended` | `manual`) take a won deal off the board while it stays Won (totals, lifecycle, history unchanged). `closeDeal()` also archives the deal's portal projects, cancels their active/paused recurring invoice schedules (matched on client + project name) and logs a `stage` activity with `metadata.closed`. `closeEndedRetainers()` closes won retainers once `retainerProgress()` says ended — in the daily invoice cron (before invoices are generated) and on every `GET /api/crm/deals`. "Close — work is finished" / "Reopen" on a won deal in the panel send `PATCH /api/crm/deals/[id]` `{ closed }`; moving a closed deal off Won reopens it. Closed retainers don't count in "Monthly retainers".
- Calls (`/admin/crm/calls`, `GET /api/crm/calls` → `loadCallLog()`): a logged call is a `crm_activities` row with kind `call` and `metadata` = `{ direction, outcome, minutes }` (`src/lib/calls.ts` reads it); `created_at` is when the call happened, so it can be back-dated. Every activity form (call, text, DM, note, meeting, email) has a **When** field (`WhenField.tsx`, defaults to now, never the future) sent as `at`; a text dated more than 10 minutes ago is just logged instead of opening Google Voice. Logged from the panel's ☏ Log call or the Calls page (`LogCallForm.tsx`); it can file under a deal and add a follow-up task, and a call where they talked moves New lead deals to Contacted. Confirmed `/book` bookings and Outlook calendar meetings show under Coming up and on the contact's timeline. No migration — calls logged before this have no details and read as plain "Call".
- Lifecycle shown everywhere (`lifecycleOf()` in `shared.ts`): Client (portal login or a won deal) → Lead (an open deal) → Prospect (`prospect_status = 'prospect'`) → Contact.
- Deleting and moving contacts (`POST /api/crm/contacts/bulk`, `src/lib/crmBulk.ts`; the panel's buttons and the Contacts/Prospects select bars via `contactActions.ts`): → Lead opens a New lead deal for anyone without an open one; → Prospect closes open deals as Lost ("Moved to Prospects") and sets `prospect_status`, and never moves clients; delete cascades to deals, notes and tasks.
- The contact timeline is assembled at read time in `src/lib/crmRepo.ts` from `crm_activities`, inquiries, `client_reminders`, builder proposals, uploaded proposals, invoices, emails sent (`prospect_emails`, `newsletter_sends`) and `email_replies`. It is not copied into one table.
- Routes: `/api/crm/deals` (+ `[id]`), `/api/crm/contacts` (+ `[id]`, `[id]/activities`, `[id]/tasks`, `[id]/portal`, `[id]/recipient`, `[id]/seen`), `/api/crm/tasks/[id]`, `/api/crm/activities/[id]`, `/api/crm/today`, `/api/crm/replies/[id]`, all gated by `requireAdmin`. "Quick message" uses the `crm_contact` reminder target, which can email anyone but texts only via a portal or proposal record that carries consent.

### Proposal builder

`/admin/crm/proposals` (in the CRM sidebar; old `/admin/proposals` URLs redirect). The page files still live in `src/app/admin/proposals/` and the CRM routes re-export them; edit/preview/tune go full-screen without the sidebar. A contact's panel starts one from the contact or from a specific open deal (`?client=&deal=` → `crm_deal_id`).

- One renderer, `src/components/proposal/ProposalRenderer.tsx`, for the builder, `/p/[slug]`, print and PDF. The look follows the printed Social Reserve proposal (Sept 2026): black pages, two-line headings (line 2 in the accent; a line 2 starting `& ` gets an oversized ampersand), kickers in the accent's partner colour (`--accent-2`) on a rule to the page edge, purple scope panels, and the total + signature as one panel when the signature block follows pricing.
- Proposal markdown (`src/lib/miniMarkdown.tsx`) adds `### ` subheadings (magenta → orange → green in turn) and `> ` callouts; `> **Label** text` puts the label in the bar's colour.
- New proposals have no cover unless "Include a cover page" is ticked; copied/templated covers are kept hidden. "Cover: on/off" in the builder's top bar toggles it. "Thrive layout" (`src/lib/proposalStarter.ts`) seeds the Social Reserve structure with empty prose.

### Outlook and Google Voice

Migration `040`. Lauren signs in to Microsoft 365 from Settings → Email (`src/lib/outlook.ts`: delegated Graph sign-in, signed state, refresh token encrypted with `PORTAL_CREDENTIALS_KEY` in `mail_connection`). hello@ is a separate mailbox she has Full Access to: it's added under "Add mailbox" (`shared_mailboxes`, read via `/users/<address>`; the `.Shared` scopes) and each mailbox keeps its own read position (`cursors`). Once connected, one-to-one emails (`sendProspect`) and reminders / quick messages (`deliver(..., { fromInbox: true })`) send from the mailbox chosen as `send_from` (default: the signed-in account; another mailbox needs Exchange "Send as"); newsletters and system notifications stay on Resend. `src/lib/outlookSync.ts` runs every 5 minutes (`GET /api/cron/outlook-sync`, and "Sync now" → `POST /api/outlook`): Inbox mail from a contact goes through `logReply()` in `inboundEmail.ts` (same as Resend replies: Today, timeline, prospect → New lead, one open "Reply to …" task), Sent Items to a contact go to `outlook_sent` unless the CRM sent it (matched on contact + subject within 15 minutes) and close their "Reply to" tasks. Mail not involving a contact is never stored. Mail from before the connection is logged without tasks or leads.

Calendar (migrations `043`, `044` adds `show_as`; `src/lib/outlookCalendar.ts`, same 5-minute sync): Lauren's own calendar from a week back to 92 days ahead is mirrored into `calendar_events` (repeating meetings expanded; deleted/cancelled ones removed; past events with no contact pruned after a week). An event links to a contact by an attendee's email, else a contact's full name in the title, else a first name only one contact has (`matched_by` email/name/manual). `MeetingLink.tsx` ("Link contact" / "Change" / "Not them", `PATCH /api/crm/calendar/[id]`) sets `contact_locked` so the sync keeps the hand-made link. Reads go through `src/lib/calendarEvents.ts`: Home's "Calls & meetings" and the digest (via `buildAdminSummary`), the Calls page's Coming up, and the contact timeline (kind `meeting`); a meeting starting within 5 minutes of a confirmed `/book` booking is treated as that booking. The sign-in stores `granted_scopes`, and token refreshes ask only for what was granted, so sign-ins from before `Calendars.Read` keep syncing mail until Lauren reconnects (Settings → Email shows "Reconnect with calendar").

Google Voice has no API: its email alerts (texts, voicemails, missed calls) are forwarded from Gmail to the Outlook inbox and parsed by `src/lib/googleVoice.ts` (pure). Each becomes a `voice_events` row and, when the number (or Google contact name) matches a contact, a `crm_activities` row — kind `text`, or kind `call` with `{ direction: 'inbound', outcome: 'voicemail' | 'no_answer', source: 'google_voice' }` so it shows on the Calls page — plus a call/text-back task. Unmatched alerts list in Settings → Email and attach once a contact has the number. Outgoing calls/texts and answered calls are never emailed by Google; `text` is also a manual activity kind for those.

### Prospects and replies

Migration `030`. Prospects are people Lauren reaches out to before they've shown interest: `crm_contacts.prospect_status = 'prospect'`, no deal, listed at `/admin/crm/prospects` (`src/lib/prospectList.ts`, `GET/POST /api/prospects` — add one or a pasted list; existing contacts are never duplicated, and anyone with deals is left alone). Any new deal for a prospect converts them (`crm_convert_prospect` trigger → `'converted'`), so the board only holds people who engaged.

- Instagram / Facebook prospects (migration `037`): `crm_contacts.instagram` (handle, no @) and `facebook` (the part after facebook.com/), normalized by `src/lib/social.ts`. A prospect needs an email, a phone (stored E.164) **or** a handle; adding matches existing contacts on any of them. Tags typed when adding ("Where did you meet them?", e.g. an expo) go on everyone in that batch, existing contacts included, without changing anyone's stage; the form remembers the last tags (localStorage) and "Add & next" keeps it open for the next card. Contacts and Prospects filter by tag. DMs are sent in the app and logged by hand (`LogDmForm.tsx`, the 💬 DM button on Prospects and "Log DM" in the panel) as `crm_activities` kind `dm`, `metadata` = `{ platform, direction: 'sent' | 'received' }`. A sent DM moves New lead deals to Contacted; a logged reply opens a New lead deal (source `instagram`/`facebook`) for a prospect, as an email reply does. Email audiences skip contacts with no email.
- Texts from Lauren's Google Voice number (no API): the ✆ Text button (Prospects rows and the contact panel, `LogTextForm.tsx`) copies the typed message, opens Google Voice on the number (`googleVoiceUrl()` in `googleVoice.ts`; an undocumented link) and logs `crm_activities` kind `text`, `metadata` = `{ direction: 'sent' | 'received', phone }`. A sent text counts as outreach (`texts_sent` / `last_text_at` on Prospects) and moves New lead deals to Contacted; a logged reply opens a New lead deal (source `phone`) for a prospect. Incoming texts also arrive automatically through the Google Voice alerts (see Outlook and Google Voice). Texts started in the Voice app itself aren't seen.
- Every email sent from the site to a contact has Reply-To `reply-<contact hex>-<hmac>@RESEND_INBOUND_DOMAIN` (`replyAddress()` in `newsletterTokens.ts`; falls back to `CONTACT_NOTIFY_TO` when unset).
- Resend receives the reply and calls `POST /api/email/inbound` (`email.received`, verified with `RESEND_WEBHOOK_SECRET`). `src/lib/inboundEmail.ts` fetches the full message, finds the contact (signed address first, then sender email), stores it once in `email_replies` (unique Resend id), strips the quoted original, stamps `replied_at`, opens a New lead deal for a prospect with no open deal (source `email reply`), adds a "Reply to …" task, and forwards the reply (attachments included) to `CONTACT_NOTIFY_TO` with Reply-To = the sender. Mail from `CONTACT_NOTIFY_FROM` itself is ignored.
- Setup status shows in Settings → Email.

### Marketing campaigns

`/admin/crm/campaigns` compares every piece of marketing, print and email (migration `031`, `src/lib/marketing.ts`). Print campaigns (`marketing_campaigns`: piece, sent date, cost, short-link `code`, destination) have recipients (`marketing_recipients`, with a hand-marked `outcome`: sent / responded / lead / won / no_response — marking "lead" opens a deal, source `print`). Email campaigns are read from sent `newsletters` + `newsletter_sends`, and one-to-one `prospect_emails` show as one line; nothing is copied. Results count replies, deals opened and deals won within `RESULT_DAYS` (60) of the send.

- Each print campaign's QR code (generated in the browser with `qrcode`, downloadable as SVG/PNG) points at `SITE_URL/m/<code>`. `src/app/m/[code]/route.ts` logs a scan in `marketing_scans` (daily-rotating visitor hash, bots skipped) and redirects to the destination with `utm_source=print&utm_medium=<piece>&utm_campaign=<code>`; analytics classifies that as the `print` channel, and an inquiry from that visit carries `utm_campaign`, which the campaign counts. Unknown codes go to the homepage.
- Print pieces appear on each recipient's timeline (kind `print`).

### Site analytics

`/admin/analytics` reports first-party traffic from `site_pageviews` (migration `020`, RLS on with no policies). Vercel Analytics and GTM/Google Ads still run alongside it, but their data can't be read back into admin; this can, and it joins to the CRM.

- `src/app/components/SiteTracker.tsx` (mounted in the root layout, production only) posts page views to `POST /api/track`. No cookies: a session id in sessionStorage, the first-ever visit's source in localStorage. `/admin`, `/portal`, `/p/` and `/api` are never tracked, nor is any browser that has signed in to admin (`thrive_no_track` in localStorage).
- Visitors (migration `034`): `SiteTracker` also keeps a random `thrive_vid` in localStorage and sends it as `site_pageviews.visitor_id`, so return visits group into one visitor. Analytics → Visitors (`/admin/analytics?tab=visitors`, `src/lib/siteVisitors.ts` → `GET /api/crm/visitors`, last 30 days, refreshes every minute) lists them by city, source, visits and the service pages they read. A visitor gets a name only when one of their sessions sent an inquiry or booked a call (`contact_inquiries.session_id`); then all their visits from that browser show on the contact's timeline (kind `visit`). No third-party identification. `/api/track` retries without `visitor_id` if 034 isn't applied. The privacy page describes this — keep it true.
- Bots that pass the user-agent check are left out at read time by `src/lib/botFilter.ts` (analytics report — so the home page and digest — and the Visitors page; a session that sent an inquiry always counts). Since migration `035`, `SiteTracker` reports the first wheel/tap/click/key on a page as `site_pageviews.interacted`; no interaction → bot. Older rows fall back to data-center towns (Council Bluffs, Boydton, Prineville…) and one page with under a second. `/api/track` retries without `interacted` if 035 isn't applied. The privacy page mentions this.
- `/api/track` is public: it drops bots, caps every field, classifies the source server-side (`src/lib/trafficSource.ts`), and stores a daily-rotating HMAC of IP + user agent instead of the IP (`ANALYTICS_SALT` if set, else the service role key).
- The contact page (`src/app/contact/page.tsx` — `ContactForm.tsx` is unused) sends its session id and first-touch source; `/api/contact` stores `source`, `channel`, `landing_path`, `first_source` and `company` on the inquiry (`src/lib/inquiryAttribution.ts`). If those columns are missing it retries the insert without them, so the form never fails on extras. The route reads `projectType`/`message` and also accepts `service`/`description`.
- `src/lib/analyticsReport.ts` aggregates in TypeScript (days in America/Chicago); `src/lib/trafficInsights.ts` holds the rules behind "How to grow traffic". Won work is attributed through the inquiry's deal.
- Google Search Console (`src/lib/searchConsole.ts`) is optional: with `GSC_SERVICE_ACCOUNT_JSON` and `GSC_SITE_URL` set, the analytics page, suggestions and digest include search queries, clicks and positions. It signs a service-account JWT itself — no Google SDK. Without them, the panel shows setup steps.

### Service page SEO

- `src/lib/serviceSeo.ts` holds each service page's `<title>`, meta description and FAQs. FAQ answers only restate what the pages already say — keep them true; Google and AI assistants quote them.
- Titles lead with the service and the place ("Custom Website Development in Dallas, TX"; the layout template adds " | Thrive Creative Studios"). The service pages render the `about` copy in `serviceSeo.ts` (what's included, who it's for) through `ServiceView`. `/services/digital-design` is shown as "Web Development" (custom-coded sites) but keeps its URL.
- Prices live in `src/lib/servicePricing.ts` (packages, add-ons, care plans, small print) and render on each service page (`ServiceView`, the price sticker reads `from`); the "From" line on `/services` reads it too. Meta descriptions in `serviceSeo.ts` mention the starting price — update both together. Never show an hourly rate anywhere on the site.
- `/amarillo-web-design` targets Amarillo (Lauren's hometown; remote, in person when she's in town). Her story goes in `HOMETOWN_STORY` in that page. Amarillo is also in the root `areaServed`.
- Each service page carries `Service`, `FAQPage` and `BreadcrumbList` JSON-LD from `serviceJsonLd()` in `ServiceFaq.tsx` (rendered by `_site/services/ServicePage.tsx`); the root layout's `ProfessionalService` (`@id` = `BUSINESS_ID`) lists the services and DFW cities. Always serialize JSON-LD with `jsonLd()` from `src/lib/seo.ts`.
- The canonical host is `thrivecreativestudios.org` (Vercel 308-redirects www to it). `robots.txt` disallows only `/api/`; `/admin`, `/portal` (noindex from their layouts plus an `X-Robots-Tag` header), `/p/` and `/review/` stay crawlable so Google can see their `noindex`. `/portfolio/:slug` redirects to `/work/:slug`.

### Journal

Articles at `/journal`, written at `/admin/journal` (migration `022`). Bodies are markdown rendered by `src/lib/articleMarkdown.tsx` as React elements — no raw HTML. Public reads use the anon key; RLS returns only published posts. Publishing/editing calls `revalidatePath` for the index, the article and the sitemap. The editor's search checklist is `src/lib/journalChecklist.ts`. Cover uploads are capped at 4 MB (Vercel's body limit is 4.5 MB).

### Opinly blog and analytics

A second blog at `/blog`, written and published in Opinly (the Journal at `/journal` is separate and unchanged). `withOpinlyConfig` in `next.config.ts` sets the SDK env vars (blog path, site URL, company name, CDN namespace `qwgvML9pOi6gEoJeyhSXO`) and rewrites `/blog-images/*` to the Opinly CDN.

- `src/lib/opinly.ts`: the content client (`force-cache`, every fetch tagged `opinly`) and an uncached events client, both created on first use because `createOpinlyClient` throws without `OPINLY_API_KEY`.
- `src/app/blog/[[...slug]]/page.tsx` routes `/blog`, `/blog/<post>`, `/blog/category/<slug>`, `/blog/tag/<slug>`, `/blog/authors[/<slug>]`; posts render with `<OpinlyContent>` inside the Journal's styles. Metadata from `generateOpinlyMetadata` (absolute canonical); JSON-LD from `buildBlogPostingJsonLd`/`buildFaqJsonLd`, serialized with `jsonLd()`. The sitemap adds `buildSitemapEntries(opinly.routes())` and leaves the blog out if Opinly is down.
- `POST /api/opinly` (Svix-verified) on `content.routes-changed`: `revalidateTag('opinly', { expire: 0 })` plus `revalidatePath` for each changed route — both are needed.
- Pixel: `OpinlyPixel` in the root layout — production only, not on `/admin`, `/portal`, `/p/`, `/review/`, `/book/<token>`, and not in browsers signed in to admin (same rule as `SiteTracker`). Admin and portal layouts carry `data-opinly-no-capture`. Forms send `opinlyAnonId` and call `opinlyIdentify(email)` on success.
- Server events (never block, sent in `after()`): `generate_lead` from `/api/contact` and `/api/booking`, `sign_up` when a newsletter subscription is confirmed, `purchase` (deduped on `invoice-<id>`) from the Stripe webhook and return-page confirm (`src/lib/opinlyStripe.ts`). The privacy page describes all of this — keep it true.

### Reviews

Requested from a won deal in the CRM (`POST /api/reviews/request`), submitted at `/review/[token]`, approved at `/admin/reviews` (migration `023`). A DB check refuses `approved` without `consent_publish`; anon can read only approved rows and only the display columns (column grants — the token is never readable). Approved reviews show on service pages via `ServiceTestimonials`. There is deliberately no Review/AggregateRating markup: Google ignores self-serving review stars.

### Book a call

`/book` (migration `025`). Weekly hours, length, buffer, notice and days off are set in Settings → Booking (`/admin/settings?tab=booking`); slots are computed in `src/lib/bookingTime.ts` (pure, DST-safe) and re-checked on booking, with a unique index on confirmed `starts_at` as the race guard. A booking also inserts a `contact_inquiries` row, so the CRM triggers create the contact/deal as for the contact form, and adds a CRM task on the call day. Both sides get an email with an `.ics` invite; `/book/[token]` cancels. Times busy on Lauren's Outlook calendar are left out (migrations `043`/`044`): `availability()` adds `calendarBusy()` from the `calendar_events` mirror (anything not marked free / workingElsewhere; all-day events block their whole Dallas days; the buffer applies), and `createBooking` re-checks the chosen slot live in Outlook (`liveBusy()` in `outlookCalendar.ts`), falling back to the mirror when Outlook can't be read. The mirror covers 92 days ahead (max notice is 90). Without Outlook connected, availability is the configured hours only.

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
