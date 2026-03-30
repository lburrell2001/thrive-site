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
SUPABASE_SERVICE_ROLE_KEY=      # Server-only (contact form API route)
RESEND_API_KEY=                  # Email notifications
CONTACT_NOTIFY_TO=               # Email address to receive inquiries
CONTACT_NOTIFY_FROM=             # Verified Resend sender address
```

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

### Styling

Global design tokens (CSS custom properties) are defined in `src/app/globals.css` under the `:root` block — brand palette, spacing, typography. Page-level scoped styles use CSS Modules (e.g. `WorkPage.module.css`, `ProjectPage.module.css`). Tailwind utility classes are used inline for layout/spacing throughout.

### SEO

`src/lib/seo.ts` exports `buildPageMetadata()` for generating consistent `Metadata` objects on static pages. Dynamic pages (`/work/[slug]`) build metadata manually from Supabase data. JSON-LD structured data is injected as inline `<script>` tags in both the root layout and project pages.
