// Per-service copy for the redesigned service pages. Everything here is the
// live service page's own wording (src/app/services/<slug>/page.tsx); prices
// come from servicePricing.ts and the longer read and FAQs from serviceSeo.ts.

import type { ServiceSlug } from '@/lib/serviceSeo';
import type { ThriveIconName } from '../ThriveIcons';

export type ServiceConfig = {
  slug: ServiceSlug;
  title: string;
  icon: ThriveIconName;
  /** Brand colour class key in redesign.module.css (bMagenta, bBlue…). */
  tone: 'bMagenta' | 'bBlue' | 'bMint' | 'bOrange' | 'bPurple';
  lede: string;
  deliverablesHeading: string;
  deliverables: { title: string; desc: string; icon: ThriveIconName }[];
  processHeading: string;
  process: { title: string; desc: string }[];
  workHeading: string;
  /** The closing band's heading, two lines. */
  cta: [string, string];
  /** One extra line under the longer read, with a link. */
  related?: { before: string; label: string; href: string; after: string };
};

export const SERVICE_CONFIGS: Record<ServiceSlug, ServiceConfig> = {
  'digital-design': {
    slug: 'digital-design',
    title: 'Web Development',
    icon: 'web',
    tone: 'bMagenta',
    lede: 'We design and build: custom-coded from scratch, or on WordPress, Wix or Squarespace when that fits — in your colors and fonts, never a template. Care plans keep it running after launch.',
    deliverablesHeading: 'Custom-coded, not templated',
    deliverables: [
      { icon: 'web', title: 'Custom-Coded Websites', desc: 'Sites written from scratch for your business, built to do exactly what you need.' },
      { icon: 'care', title: 'Care Plans', desc: 'Hosting, security updates, backups and monthly edits after launch.' },
      { icon: 'landing', title: 'Landing Pages', desc: 'Focused single pages that drive sign-ups, sales or inquiries.' },
      { icon: 'edit', title: 'Edit It Yourself', desc: 'With Large and Custom sites, an admin area so your team can edit text and photos.' },
      { icon: 'analytics', title: 'Forms, Analytics & SEO', desc: 'Forms that reach the right inbox, visitor insights and search groundwork, built in.' },
      { icon: 'mobile', title: 'Mobile-First Layouts', desc: 'Every page designed for phones first and tested on phones and desktops.' },
    ],
    processHeading: 'From brief to live site',
    process: [
      { title: 'Discovery', desc: 'We align on goals, audience, the pages you need, and which package fits.' },
      { title: 'Design', desc: 'A page-by-page plan, then full visual design: color, type, imagery and layout.' },
      { title: 'Build', desc: 'Your site coded from scratch, in your colors and fonts.' },
      { title: 'Launch', desc: 'Tested on phones and desktops, then launched.' },
    ],
    workHeading: 'Sites we’ve built',
    cta: ['Ready for a Website', 'That Works?'],
    related: { before: 'We also work with businesses in Amarillo. See our ', label: 'Amarillo web development', href: '/amarillo-web-design', after: ' page.' },
  },
  'brand-design': {
    slug: 'brand-design',
    title: 'Brand Design',
    icon: 'brand',
    tone: 'bBlue',
    lede: 'Logo, colors, type and a full identity system built around your story — so you stop blending in and start standing out.',
    deliverablesHeading: 'Everything your brand needs',
    deliverables: [
      { icon: 'pen', title: 'Logo Design', desc: 'A primary mark and lockup variations built to work everywhere — digital, print, and beyond.' },
      { icon: 'palette', title: 'Color System', desc: 'A full palette with hex codes and usage rules that make your brand recognizable at a glance.' },
      { icon: 'type', title: 'Typography', desc: 'Font pairing and hierarchy that makes every headline and caption feel intentional.' },
      { icon: 'book', title: 'Brand Guidelines', desc: 'A living doc covering logo usage, colors, typography, do’s and don’ts.' },
      { icon: 'card', title: 'Social & Print Pieces', desc: 'Social media profile and cover images and a business card design, with a full identity.' },
      { icon: 'folder', title: 'Final Files', desc: 'Every final file packaged and delivered for print and web.' },
    ],
    processHeading: 'How we build it',
    process: [
      { title: 'Discovery', desc: 'Quick call + vibe alignment. We lock goals, scope, and the look we’re chasing.' },
      { title: 'Concepts', desc: 'Two logo concepts so you can choose the one that feels most like you.' },
      { title: 'Refinement', desc: 'We polish the system: spacing, type, color — everything gets tight.' },
      { title: 'Delivery', desc: 'Final exports + brand guidelines. Clean files, clear instructions.' },
    ],
    workHeading: 'Brands we’ve built',
    cta: ['Ready to Build', 'Your Brand?'],
  },
  'social-media': {
    slug: 'social-media',
    title: 'Social Media',
    icon: 'social',
    tone: 'bMint',
    lede: 'A content calendar, designed graphics, edited videos, captions and posting every month — and you approve everything before it goes out.',
    deliverablesHeading: 'Your full social presence, handled',
    deliverables: [
      { icon: 'calendar', title: 'Content Calendar', desc: 'A full month of posts planned, reviewed, and approved before anything goes live.' },
      { icon: 'video', title: 'Design & Video Editing', desc: 'Every post designed and every video edited to look like your brand.' },
      { icon: 'hashtag', title: 'Captions & Hashtags', desc: 'Copy written for each post, with hashtags that fit.' },
      { icon: 'send', title: 'Scheduling & Posting', desc: 'Posts go out on a consistent schedule, so your accounts never go quiet.' },
      { icon: 'analytics', title: 'Analytics Reporting', desc: 'Optional add-on: a monthly report on reach, engagement, and follower growth.' },
    ],
    processHeading: 'We take it off your plate',
    process: [
      { title: 'Plan', desc: 'We map out the month’s posts in a content calendar, built around your goals.' },
      { title: 'Create', desc: 'Graphics designed, videos edited, captions and hashtags written.' },
      { title: 'Approve', desc: 'You review everything before anything posts.' },
      { title: 'Post', desc: 'We schedule and post on a consistent rhythm — you stay focused on your business.' },
    ],
    workHeading: 'Posts we’ve made',
    cta: ['Ready to Grow', 'Your Audience?'],
  },
  'ux-design': {
    slug: 'ux-design',
    title: 'UX/UI Design',
    icon: 'ux',
    tone: 'bOrange',
    lede: 'App and website prototypes that feel as good as they look — click through every screen before anyone writes code.',
    deliverablesHeading: 'Designed for real humans',
    deliverables: [
      { icon: 'sitemap', title: 'Information Architecture', desc: 'Sitemaps and user flows that make navigation feel obvious, not learned.' },
      { icon: 'wireframe', title: 'Wireframes', desc: 'Low-fidelity layouts that map content and structure before visual design begins.' },
      { icon: 'ux', title: 'Interactive Prototypes', desc: 'Clickable prototypes you can tap through on a phone or computer.' },
      { icon: 'folder', title: 'Developer Handoff', desc: 'Design files handed off, ready for your developer.' },
    ],
    processHeading: 'From idea to clickable prototype',
    process: [
      { title: 'Plan', desc: 'We map the screens your app or site needs and how people move between them.' },
      { title: 'Layouts', desc: 'Screen-by-screen layouts, from structure to full visual design.' },
      { title: 'Prototype', desc: 'A clickable prototype, with two rounds of revisions.' },
      { title: 'Handoff', desc: 'Design files handed off, ready for your developer.' },
    ],
    workHeading: 'Apps we’ve designed',
    cta: ['Got a Product', 'That Needs Love?'],
  },
  photography: {
    slug: 'photography',
    title: 'Photography',
    icon: 'photo',
    tone: 'bPurple',
    lede: 'Real images of your people, your product and your space — so you never need a stock photo standing in for you.',
    deliverablesHeading: 'Images that make an impression',
    deliverables: [
      { icon: 'photo', title: 'Brand Photography', desc: 'Intentional images that show who you are — not just what you sell.' },
      { icon: 'person', title: 'Headshots', desc: 'Professional portraits that feel real, confident, and distinctly you.' },
      { icon: 'box', title: 'Product Photography', desc: 'Clean, editorial-style shots that make your products impossible to scroll past.' },
      { icon: 'calendar', title: 'Event Coverage', desc: 'Candid and composed shots of launches, pop-ups, and brand moments worth remembering.' },
      { icon: 'sparkle', title: 'Retouching & Editing', desc: 'Every image is color-graded and retouched to match your brand aesthetic.' },
      { icon: 'folder', title: 'Licensed Deliverables', desc: 'High-resolution files licensed for web, print, and social — ready to use anywhere.' },
    ],
    processHeading: 'From brief to gallery',
    process: [
      { title: 'Consultation', desc: 'We talk about your brand, the feel you want, and what we need to capture.' },
      { title: 'Shot List', desc: 'A clear plan for every shot — no wasted time, no wondering what comes next.' },
      { title: 'Session', desc: 'The shoot. We direct, capture, and adapt in real time to get the best version of every frame.' },
      { title: 'Delivery', desc: 'Edited gallery delivered within 7 days — web and print resolutions, all licensed.' },
    ],
    workHeading: '2026 grad portraits',
    cta: ['Ready to Capture', 'Your Brand?'],
  },
};
