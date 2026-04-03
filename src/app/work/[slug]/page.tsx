// src/app/work/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLayout from "../../components/PublicLayout";
import { supabase } from "../../../lib/supabaseServer";
import { projectCover } from "@/lib/storage";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import ProjectGallery from "./ProjectGallery";

// ── Static per-project data ───────────────────────────────────────────────────

type ProjectData = {
  slug: string;
  name: string;
  category: string;
  services: string;
  description: string;
  stats: { value: string; label: string }[];
  deliverables: string[];
  quote: string;
  quoteAuthor: string;
  next: string;
};

const PROJECTS: ProjectData[] = [
  {
    slug: "brewhaus",
    name: "Brewhaus",
    category: "Branding",
    services: "Brand Identity, Visual Design",
    description:
      "A bold rebrand for a bold brand. Brewhaus needed a visual identity that stood out on shelves and screens alike. We built a system rooted in craft, character, and culture — one that commands attention from the first glance.",
    stats: [
      { value: "Full", label: "Brand Identity" },
      { value: "New", label: "Visual System" },
      { value: "100%", label: "Custom Design" },
    ],
    deliverables: ["Logo Suite", "Color System", "Brand Guidelines", "Print Collateral"],
    quote: "Thrive gave us a brand that finally matched the quality of our product.",
    quoteAuthor: "Brewhaus",
    next: "burrell-group",
  },
  {
    slug: "burrell-group",
    name: "The Burrell Group",
    category: "Website Redesign",
    services: "Website Design, Brand Identity",
    description:
      "The Burrell Group needed an identity and web presence as authoritative and forward-thinking as the work they do. We created a brand system and website built on confidence, clarity, and culture — one that immediately positions them as leaders in their space.",
    stats: [
      { value: "Full", label: "Website Redesign" },
      { value: "New", label: "Brand System" },
      { value: "100%", label: "Custom Build" },
    ],
    deliverables: ["Website Design", "Logo Suite", "Color System", "Brand Guidelines"],
    quote: "The work they did set us apart immediately. Bold, intentional, and exactly right.",
    quoteAuthor: "The Burrell Group",
    next: "curl-co",
  },
  {
    slug: "curl-co",
    name: "Curl & Co",
    category: "Branding",
    services: "Brand Identity, Social Media",
    description:
      "Curl & Co came to us with a great product and a brand that was not telling the full story. We rebuilt their visual identity from the ground up — celebrating texture, personality, and the community they serve.",
    stats: [
      { value: "Full", label: "Brand Identity" },
      { value: "New", label: "Social Presence" },
      { value: "100%", label: "Custom Design" },
    ],
    deliverables: ["Logo Suite", "Color System", "Social Templates", "Brand Guidelines"],
    quote: "Thrive understood our community and built a brand that speaks directly to them.",
    quoteAuthor: "Curl & Co",
    next: "dj-mastamind",
  },
  {
    slug: "dj-mastamind",
    name: "DJ Mastamind",
    category: "Branding",
    services: "Brand Identity, Social Media",
    description:
      "DJ Mastamind came to Thrive needing a full brand overhaul — from a dated visual identity to a social media presence that actually matched his energy and reach. We built something bold, intentional, and impossible to scroll past. The result was a complete brand system that tripled engagement in the first 60 days.",
    stats: [
      { value: "3x", label: "Engagement Increase" },
      { value: "60", label: "Days to Results" },
      { value: "100%", label: "Brand Refresh" },
    ],
    deliverables: ["Logo Suite", "Color System", "Social Templates", "Content Strategy"],
    quote:
      "Thrive completely transformed how my brand shows up. The energy, the vision, the execution — nothing short of exceptional.",
    quoteAuthor: "DJ Mastamind",
    next: "safespace",
  },
  {
    slug: "safespace",
    name: "Safespace",
    category: "Branding & UX Design",
    services: "Brand Identity, UX Design",
    description:
      "Safespace needed a brand and digital experience that felt as welcoming and accessible as their mission. We built a visual identity and UX system that puts community first — intuitive, human-centered, and deeply intentional.",
    stats: [
      { value: "Full", label: "Brand Identity" },
      { value: "New", label: "UX System" },
      { value: "100%", label: "Custom Design" },
    ],
    deliverables: ["Logo Suite", "Brand Guidelines", "UX Design", "Prototype"],
    quote: "The team at Thrive got our mission immediately and translated it into something beautiful.",
    quoteAuthor: "Safespace",
    next: "soulcheck",
  },
  {
    slug: "soulcheck",
    name: "Soul Check",
    category: "UX Design",
    services: "UX Design, Digital Design",
    description:
      "A digital platform built for connection and accountability. Soul Check needed a clean, modern interface that made the experience seamless from day one — easy to navigate, impossible to put down.",
    stats: [
      { value: "Full", label: "UX Overhaul" },
      { value: "New", label: "Design System" },
      { value: "100%", label: "Custom UI" },
    ],
    deliverables: ["UX Design", "UI Design", "Design System", "Prototype"],
    quote: "Thrive delivered a product that our users immediately loved. Clean, intuitive, and on brand.",
    quoteAuthor: "Soul Check",
    next: "squeeze-shop",
  },
  {
    slug: "squeeze-shop",
    name: "Squeeze Shop",
    category: "Branding",
    services: "Brand Identity, Social Media",
    description:
      "Fresh, fun, and unforgettable — exactly what Squeeze Shop needed. We built a brand identity as vibrant as their product line, with a visual system designed to pop on shelves and screens alike.",
    stats: [
      { value: "Full", label: "Brand Identity" },
      { value: "New", label: "Visual System" },
      { value: "100%", label: "Custom Design" },
    ],
    deliverables: ["Logo Suite", "Color System", "Packaging Design", "Social Templates"],
    quote: "Our customers notice the difference. Thrive gave us a brand with real personality.",
    quoteAuthor: "Squeeze Shop",
    next: "st-john",
  },
  {
    slug: "st-john",
    name: "St. John",
    category: "Website Design",
    services: "Website Design, Photography",
    description:
      "A refined web presence for a refined brand. St. John needed a digital home that matched the elegance and intentionality of everything they stand for — clean, elevated, and built to convert.",
    stats: [
      { value: "Full", label: "Website Design" },
      { value: "New", label: "Visual Direction" },
      { value: "100%", label: "Custom Build" },
    ],
    deliverables: ["Website Design", "Photography Direction", "Brand Styling", "Launch Assets"],
    quote: "Thrive built us something we are genuinely proud to send people to.",
    quoteAuthor: "St. John",
    next: "tckt",
  },
  {
    slug: "tckt",
    name: "TCKT",
    category: "UX Design",
    services: "UX Design, Digital Design",
    description:
      "TCKT needed a platform that was as seamless as the experiences they help create. We delivered clean UI, smart UX, and a design system built to scale — making every interaction feel effortless.",
    stats: [
      { value: "Full", label: "UX Design" },
      { value: "New", label: "Design System" },
      { value: "100%", label: "Custom UI" },
    ],
    deliverables: ["UX Design", "UI Design", "Design System", "Developer Handoff"],
    quote: "The UX work Thrive did completely changed how our users experience the platform.",
    quoteAuthor: "TCKT",
    next: "thrive-site",
  },
  {
    slug: "thrive-site",
    name: "Thrive Site",
    category: "Website Design",
    services: "Website Design, Brand Identity",
    description:
      "The Thrive website itself — a full-service creative agency site built to represent everything we stand for. Bold, eclectic, and built different. Every section designed to convert curious visitors into booked clients.",
    stats: [
      { value: "Full", label: "Website Design" },
      { value: "New", label: "Brand System" },
      { value: "100%", label: "Custom Build" },
    ],
    deliverables: ["Website Design", "Brand Identity", "Content Strategy", "Development"],
    quote: "Built by Thrive, for Thrive. This is what we stand for.",
    quoteAuthor: "Thrive Creative Studios",
    next: "brewhaus",
  },
];

const PROJECTS_BY_SLUG = Object.fromEntries(PROJECTS.map((p) => [p.slug, p]));

const ACCENT_COLORS = ["#e50586", "#fd6100", "#0cf574", "#1e3ade"];

// ── Types ─────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  category_label?: string | null;
  span: string | null;
  tagline?: string | null;
  overview?: string | null;
  role?: string | null;
  year?: string | null;
  tools?: string[] | null;
  problem?: string | null;
  solution?: string | null;
  results?: string | null;
  project_notes?: string | null;
  services?: string | null;
  highlights?: string[] | null;
  deliverables?: string[] | null;
  timeframe?: string | null;
  status?: string | null;
  featured?: boolean | null;
};

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("title,slug,overview,tagline,category")
    .eq("slug", slug)
    .maybeSingle<{ title: string; slug: string; overview?: string | null; tagline?: string | null; category?: string | null }>();

  const staticData = PROJECTS_BY_SLUG[slug];
  if (!project && !staticData) return { title: "Project", robots: { index: false, follow: false } };

  const title = project?.title ?? staticData?.name ?? slug;
  const metaDescription =
    project?.overview ?? project?.tagline ?? staticData?.description ?? `${title} — a project by Thrive Creative Studios.`;
  const coverSrc = projectCover(slug);

  return {
    title,
    description: metaDescription,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      title,
      description: metaDescription,
      url: `/work/${slug}`,
      type: "article",
      images: [{ url: coverSrc, alt: `${title} cover` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [coverSrc],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProjectSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch from Supabase (optional — page works without DB row)
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Project>();

  // Resolve static data
  const pdata = PROJECTS_BY_SLUG[slug];

  // If neither DB row nor static entry exists, 404
  if (!project && !pdata) notFound();

  const title = project?.title ?? pdata?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const category = project?.category ?? pdata?.category ?? "Brand Design";
  const categoryLabel = project?.category_label ?? category;
  const year = project?.year ?? "2024";
  const overview =
    project?.overview ??
    project?.tagline ??
    pdata?.description ??
    `${title} — a project by ${SITE_NAME}.`;

  // Cover image
  const coverUrl = projectCover(slug);

  // Gallery images (for Section 4 right column)
  const BUCKET = "course-media";
  const galleryFolder = `projects/${slug}/gallery`;
  const { data: files } = await supabase.storage.from(BUCKET).list(galleryFolder, { limit: 100 });
  const galleryImages =
    files
      ?.filter((f) => f.name && !f.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((f) => ({
        url: supabase.storage.from(BUCKET).getPublicUrl(`${galleryFolder}/${f.name}`).data.publicUrl,
        alt: `${title} gallery image`,
      })) ?? [];

  // Next project (from "next" field in data)
  const nextSlug = pdata?.next ?? PROJECTS[0].slug;
  const nextData = PROJECTS_BY_SLUG[nextSlug];
  const { data: nextProject } = await supabase
    .from("projects")
    .select("title,slug,category")
    .eq("slug", nextSlug)
    .maybeSingle<{ title: string; slug: string; category: string | null }>();
  const nextTitle = nextProject?.title ?? nextData?.name ?? nextSlug;
  const nextCategory = nextProject?.category ?? nextData?.category ?? "Brand Design";

  // More work: 3 projects excluding current
  const moreWork = PROJECTS.filter((p) => p.slug !== slug).slice(0, 3);

  // JSON-LD
  const projectUrl = absoluteUrl(`/work/${slug}`);
  const projectJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    url: projectUrl,
    description: overview,
    image: coverUrl,
    creator: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    about: category,
  };

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />

      <style>{`
        /* ── BASE ── */
        .wp-page {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          color: #0a0a0a;
        }

        /* ── S1 HERO ── */
        .wp-hero {
          position: relative;
          min-height: 600px;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 80px 64px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .wp-hero-bg {
          position: absolute;
          inset: 0;
          object-fit: cover;
          width: 100%;
          height: 100%;
          display: block;
        }
        .wp-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.2) 100%);
          z-index: 1;
        }
        .wp-hero-ghost {
          position: absolute;
          bottom: -20px;
          left: -10px;
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(80px, 12vw, 160px);
          color: rgba(255,255,255,0.07);
          white-space: nowrap;
          pointer-events: none;
          line-height: 1;
          z-index: 2;
          user-select: none;
        }
        .wp-hero-content {
          position: relative;
          z-index: 3;
        }
        .wp-hero-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #0cf574;
          color: #000;
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 13px;
          padding: 8px 18px;
          border-radius: 20px;
          text-decoration: none;
          margin-bottom: 20px;
          transition: opacity .15s;
        }
        .wp-hero-back:hover { opacity: 0.85; }
        .wp-hero-cat {
          display: inline-block;
          background: #e50586;
          color: #fff;
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 11px;
          letter-spacing: 2px;
          padding: 6px 14px;
          border-radius: 4px;
          margin-bottom: 20px;
          text-transform: uppercase;
        }
        .wp-hero-title {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(40px, 6vw, 72px);
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0 0 14px;
        }
        .wp-hero-services {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(16px, 2vw, 22px);
          color: #e50586;
          margin: 0 0 24px;
          letter-spacing: -0.01em;
        }
        .wp-hero-year-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .wp-hero-year-bar {
          width: 2px;
          height: 32px;
          background: #e50586;
          flex-shrink: 0;
        }
        .wp-hero-year-label {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        /* ── S2 META BAR ── */
        .wp-meta {
          background: #0a0a0a;
          min-height: 96px;
          display: flex;
          align-items: center;
          padding: 0 80px;
          box-sizing: border-box;
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.08);
          flex-wrap: wrap;
        }
        .wp-meta-item {
          flex: 1;
          min-width: 140px;
          padding: 20px 0;
          border-right: 1px solid rgba(255,255,255,0.08);
          padding-right: 40px;
          padding-left: 0;
        }
        .wp-meta-item:first-child { padding-left: 0; }
        .wp-meta-item:last-child { border-right: none; padding-right: 0; padding-left: 40px; }
        .wp-meta-label {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 4px;
          display: block;
        }
        .wp-meta-value {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }

        /* ── S3 OVERVIEW ── */
        .wp-overview {
          background: #fff;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 64px;
          padding: 80px 80px;
          box-sizing: border-box;
          align-items: start;
        }
        .wp-overview-eyebrow {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #808080;
          margin-bottom: 12px;
          display: block;
        }
        .wp-overview-heading {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(36px, 5vw, 52px);
          letter-spacing: -0.04em;
          line-height: 1;
          margin: 0 0 24px;
        }
        .wp-overview-accent {
          width: 4px;
          height: 48px;
          background: #e50586;
          border-radius: 2px;
          margin-bottom: 28px;
        }
        .wp-overview-text {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 16px;
          line-height: 1.85;
          color: #444;
          margin: 0 0 20px;
        }
        .wp-stats-card {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }
        .wp-stats-card-bar {
          height: 4px;
          background: #e50586;
        }
        .wp-stats-card-body {
          padding: 32px;
          display: grid;
          gap: 28px;
        }
        .wp-stat-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding-bottom: 24px;
        }
        .wp-stat-row:last-child { border-bottom: none; padding-bottom: 0; }
        .wp-stat-value {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 38px;
          color: #e50586;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .wp-stat-label {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 13px;
          color: #808080;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* ── S4 IMAGE GRID ── */
        .wp-imgrid {
          background: #f1f0ee;
        }
        /* 0 images — single full-width cover */
        .wp-imgrid-solo {
          height: 520px;
          overflow: hidden;
        }
        .wp-imgrid-solo img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        /* 1 image — cover 2/3 + one image 1/3 */
        .wp-imgrid-two {
          display: grid;
          grid-template-columns: 2fr 1fr;
          min-height: 520px;
        }
        /* 2 images — cover left + 2 stacked right */
        .wp-imgrid-three {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 560px;
        }
        .wp-imgrid-three .wp-ig-right {
          display: grid;
          grid-template-rows: 1fr 1fr;
        }
        /* 3+ images — cover top-left + grid of rest */
        .wp-imgrid-many {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-auto-rows: 280px;
        }
        .wp-imgrid-many .wp-ig-cover {
          grid-row: span 2;
        }
        .wp-imgrid-many .wp-ig-extra {
          overflow: hidden;
        }
        /* shared cell styles */
        .wp-ig-cell {
          position: relative;
          overflow: hidden;
        }
        .wp-ig-cell img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .wp-ig-divider-v { border-left: 4px solid #fff; }
        .wp-ig-divider-t { border-top: 4px solid #fff; }

        /* ── S5 DELIVERABLES ── */
        .wp-deliv {
          background: #f5f0eb;
          padding: 80px;
          box-sizing: border-box;
        }
        .wp-deliv-eyebrow {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #808080;
          margin-bottom: 12px;
          display: block;
        }
        .wp-deliv-heading {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(36px, 5vw, 52px);
          letter-spacing: -0.04em;
          line-height: 1;
          margin: 0 0 48px;
        }
        .wp-deliv-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .wp-deliv-card {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          overflow: hidden;
        }
        .wp-deliv-card-bar {
          height: 4px;
        }
        .wp-deliv-card-body {
          padding: 24px 20px;
        }
        .wp-deliv-card-name {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 18px;
          letter-spacing: -0.02em;
          margin: 0 0 10px;
        }
        .wp-deliv-card-desc {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 12px;
          color: #808080;
          line-height: 1.6;
          margin: 0;
        }

        /* ── S6 FULL IMAGE ── */
        .wp-fullimg {
          height: 380px;
          overflow: hidden;
          background: #0a0a0a;
        }
        .wp-fullimg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0.9;
        }

        /* ── S7 TESTIMONIAL ── */
        .wp-testi {
          background: #0a0a0a;
          padding: 80px;
          box-sizing: border-box;
          display: flex;
          align-items: flex-start;
          gap: 32px;
        }
        .wp-testi-bar {
          width: 6px;
          min-height: 80px;
          background: #e50586;
          border-radius: 3px;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .wp-testi-content {
          max-width: 860px;
        }
        .wp-testi-quote {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(18px, 2.5vw, 22px);
          color: #fff;
          letter-spacing: -0.02em;
          line-height: 1.5;
          margin: 0 0 20px;
        }
        .wp-testi-attr {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 14px;
          color: #e50586;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* ── S8 MORE WORK ── */
        .wp-more {
          background: #f1f0ee;
          padding: 40px 80px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .wp-more-label {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #808080;
          flex-shrink: 0;
        }
        .wp-more-pills {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .wp-more-pill {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 14px;
          padding: 10px 22px;
          border-radius: 20px;
          text-decoration: none;
          transition: opacity .15s, transform .12s;
        }
        .wp-more-pill:hover { opacity: 0.85; transform: scale(1.04); }

        /* ── S9 NEXT PROJECT ── */
        .wp-next {
          background: #fff;
          padding: 64px 80px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          flex-wrap: wrap;
          border-top: 1px solid rgba(0,0,0,0.08);
        }
        .wp-next-left {}
        .wp-next-eyebrow {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #808080;
          margin-bottom: 8px;
          display: block;
        }
        .wp-next-title {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: clamp(28px, 4vw, 48px);
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0 0 8px;
        }
        .wp-next-cat {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 16px;
          color: #808080;
          margin: 0;
        }
        .wp-next-btn {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 16px;
          background: #e50586;
          color: #fff;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          white-space: nowrap;
          transition: opacity .15s, transform .12s;
          flex-shrink: 0;
        }
        .wp-next-btn:hover { opacity: 0.88; transform: scale(1.03); }

        /* ── TABLET ── */
        @media (max-width: 960px) {
          .wp-hero { padding: 0 48px 56px; }
          .wp-meta { padding: 0 48px; }
          .wp-overview { padding: 60px 48px; grid-template-columns: 1fr 360px; gap: 40px; }
          .wp-deliv { padding: 60px 48px; }
          .wp-deliv-grid { grid-template-columns: repeat(2, 1fr); }
          .wp-testi { padding: 60px 48px; }
          .wp-more { padding: 32px 48px; }
          .wp-next { padding: 48px 48px; }
        }

        /* ── MOBILE ── */
        @media (max-width: 767px) {
          .wp-hero { padding: 0 24px 48px; min-height: 480px; }
          .wp-meta { padding: 0 24px; }
          .wp-meta-item { min-width: 50%; border-right: none; padding: 16px 0; padding-left: 0; }
          .wp-meta-item:last-child { padding-left: 0; }
          .wp-overview { grid-template-columns: 1fr; padding: 56px 24px; gap: 40px; }
          .wp-imgrid-solo { height: 300px; }
          .wp-imgrid-two,
          .wp-imgrid-three,
          .wp-imgrid-many { grid-template-columns: 1fr; }
          .wp-imgrid-two .wp-ig-cell,
          .wp-imgrid-three .wp-ig-cell,
          .wp-ig-cover,
          .wp-ig-extra { height: 260px; }
          .wp-ig-divider-v { border-left: none; border-top: 4px solid #fff; }
          .wp-imgrid-three .wp-ig-right { grid-template-columns: 1fr 1fr; grid-template-rows: auto; }
          .wp-imgrid-many { grid-auto-rows: 240px; }
          .wp-imgrid-many .wp-ig-cover { grid-row: span 1; }
          .wp-deliv { padding: 56px 24px; }
          .wp-deliv-grid { grid-template-columns: 1fr 1fr; }
          .wp-fullimg { height: 240px; }
          .wp-testi { padding: 56px 24px; }
          .wp-more { padding: 32px 24px; }
          .wp-next { padding: 48px 24px; }
        }
        @media (max-width: 480px) {
          .wp-deliv-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wp-page">

        {/* ── S1 HERO ── */}
        <section className="wp-hero">
          <img src={coverUrl} alt={title} className="wp-hero-bg" />
          <div className="wp-hero-overlay" />
          <div className="wp-hero-ghost">{title.toUpperCase()}</div>

          <div className="wp-hero-content">
            <a href="/portfolio" className="wp-hero-back">← Back to Portfolio</a>
            <div className="wp-hero-cat" style={{ marginLeft: 16 }}>{categoryLabel}</div>
            <h1 className="wp-hero-title">{title.toUpperCase()}</h1>
            <p className="wp-hero-services">{categoryLabel}</p>
            <div className="wp-hero-year-row">
              <div className="wp-hero-year-bar" />
              <span className="wp-hero-year-label">{year}</span>
            </div>
          </div>
        </section>

        {/* ── S2 META BAR ── */}
        <div className="wp-meta">
          <div className="wp-meta-item">
            <span className="wp-meta-label">Client</span>
            <span className="wp-meta-value">{pdata?.name ?? title}</span>
          </div>
          <div className="wp-meta-item" style={{ paddingLeft: 40 }}>
            <span className="wp-meta-label">Services</span>
            <span className="wp-meta-value">{pdata?.services ?? category}</span>
          </div>
          <div className="wp-meta-item" style={{ paddingLeft: 40 }}>
            <span className="wp-meta-label">Timeline</span>
            <span className="wp-meta-value">{year}</span>
          </div>
          <div className="wp-meta-item">
            <span className="wp-meta-label">Status</span>
            <span className="wp-meta-value">Completed</span>
          </div>
        </div>

        {/* ── S3 OVERVIEW ── */}
        <section className="wp-overview" style={(pdata?.stats?.length ?? 0) === 0 ? { gridTemplateColumns: '1fr' } : undefined}>
          <div>
            <span className="wp-overview-eyebrow">The Project</span>
            <h2 className="wp-overview-heading">OVERVIEW</h2>
            <div className="wp-overview-accent" />
            <p className="wp-overview-text">{overview}</p>
            {project?.problem && (
              <p className="wp-overview-text">{project.problem}</p>
            )}
          </div>

          {(pdata?.stats?.length ?? 0) > 0 && (
            <div className="wp-stats-card">
              <div className="wp-stats-card-bar" />
              <div className="wp-stats-card-body">
                {pdata!.stats.map((stat, i) => (
                  <div key={i} className="wp-stat-row">
                    <span className="wp-stat-value">{stat.value}</span>
                    <span className="wp-stat-label">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── S4 GALLERY ── */}
        {galleryImages.length > 0 && (
          <div style={{ padding: '0 0 48px' }}>
            <ProjectGallery items={galleryImages} title={title} />
          </div>
        )}

        {/* ── S5 DELIVERABLES ── */}
        {(pdata?.deliverables?.length ?? 0) > 0 && (
          <section className="wp-deliv">
            <span className="wp-deliv-eyebrow">What We Built</span>
            <h2 className="wp-deliv-heading">DELIVERABLES</h2>
            <div className="wp-deliv-grid">
              {pdata!.deliverables.map((name, i) => (
                <div key={i} className="wp-deliv-card">
                  <div className="wp-deliv-card-bar" style={{ background: ACCENT_COLORS[i % ACCENT_COLORS.length] }} />
                  <div className="wp-deliv-card-body">
                    <div className="wp-deliv-card-name">{name}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── S6 FULL WIDTH IMAGE ── */}
        {(pdata?.deliverables?.length ?? 0) > 0 && (
          <div className="wp-fullimg">
            <img src={coverUrl} alt={`${title} brand mockup`} />
          </div>
        )}

        {/* ── S7 TESTIMONIAL ── */}
        {pdata?.quote ? (
          <section className="wp-testi">
            <div className="wp-testi-bar" />
            <div className="wp-testi-content">
              <p className="wp-testi-quote">&ldquo;{pdata.quote}&rdquo;</p>
              <span className="wp-testi-attr">— {pdata.quoteAuthor}</span>
            </div>
          </section>
        ) : null}

        {/* ── S8 MORE WORK ── */}
        <div className="wp-more">
          <span className="wp-more-label">More Work</span>
          <div className="wp-more-pills">
            {moreWork.map((p, i) => {
              const colors = [
                { bg: "#e50586", color: "#fff" },
                { bg: "#fd6100", color: "#000" },
                { bg: "#0cf574", color: "#000" },
              ];
              const c = colors[i % colors.length];
              return (
                <a
                  key={p.slug}
                  href={`/work/${p.slug}`}
                  className="wp-more-pill"
                  style={{ background: c.bg, color: c.color }}
                >
                  {p.name}
                </a>
              );
            })}
          </div>
        </div>

        {/* ── S9 NEXT PROJECT ── */}
        <div className="wp-next">
          <div className="wp-next-left">
            <span className="wp-next-eyebrow">Next Project</span>
            <h2 className="wp-next-title">{nextTitle.toUpperCase()}</h2>
            <p className="wp-next-cat">{nextCategory}</p>
          </div>
          <a href={`/work/${nextSlug}`} className="wp-next-btn">VIEW PROJECT →</a>
        </div>

      </div>
    </PublicLayout>
  );
}
