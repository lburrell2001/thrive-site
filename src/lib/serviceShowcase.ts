// The five services as the homepage and /services show them: copy, colour,
// sticker photo and card media. Prices live in servicePricing.ts.

import type { ServiceSlug } from "./serviceSeo";

export type ServiceTone = "pink" | "green" | "orange" | "blue" | "black";

export type ShowcaseService = {
  slug: ServiceSlug;
  /** Title case, e.g. for the sticker ring and aria labels. */
  title: string;
  /** Display name in capitals. */
  name: string;
  tag: string;
  sub: string;
  desc: string;
  href: string;
  tone: ServiceTone;
  /** Square-ish photo for the round sticker. */
  sticker: string;
  /** Card media: a local image, or a video in storage with a poster. */
  media: { type: "image" | "video"; src: string; local?: boolean; poster?: string };
};

export const SHOWCASE: ShowcaseService[] = [
  {
    slug: "digital-design", title: "Web Development", name: "WEB DEVELOPMENT", tag: "01 — Web",
    sub: "TIMELINE SCOPED TO YOUR PROJECT",
    desc: "Custom-coded websites built from scratch for your business — designed in your colors and fonts, not a template.",
    href: "/services/digital-design", tone: "pink",
    sticker: "/new-thrive/services/web-development.webp",
    media: { type: "image", src: "/new-thrive/services/web-development.webp", local: true },
  },
  {
    slug: "social-media", title: "Social Media", name: "SOCIAL MEDIA", tag: "02 — Social",
    sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "Content editing and consistent posting: designed posts, edited videos and captions, scheduled and posted every month.",
    href: "/services/social-media", tone: "green",
    sticker: "/new-thrive/services/social-media.webp",
    media: { type: "video", src: "hero-social.mp4", poster: "/new-thrive/services/social-media.webp" },
  },
  {
    slug: "ux-design", title: "UX Design", name: "UX DESIGN", tag: "03 — UX",
    sub: "EXPERIENCES PEOPLE ACTUALLY LOVE",
    desc: "Human-centered product design that makes digital experiences feel effortless and intuitive — from wireframes to polished prototypes.",
    href: "/services/ux-design", tone: "orange",
    sticker: "/new-thrive/services/ux.webp",
    media: { type: "video", src: "ux-hero.mp4", poster: "/new-thrive/services/ux.webp" },
  },
  {
    slug: "brand-design", title: "Brand Design", name: "BRAND DESIGN", tag: "04 — Brand",
    sub: "ALL YOURS IN ONLY 4–6 WEEKS",
    desc: "Complete visual identities — logos, color systems, typography, and brand guidelines — built from the ground up to set you apart in your industry.",
    href: "/services/brand-design", tone: "blue",
    sticker: "/new-thrive/services/brand-design.webp",
    media: { type: "video", src: "thrive-hero-v2.mp4", poster: "/new-thrive/services/brand-design.webp" },
  },
  {
    slug: "photography", title: "Photography", name: "PHOTOGRAPHY", tag: "05 — Photo",
    sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Brand photography and visual storytelling that captures real culture, real beauty, and real depth — bold, intentional, unforgettable.",
    href: "/services/photography", tone: "black",
    sticker: "/new-thrive/services/photo.webp",
    media: { type: "image", src: "/new-thrive/services/photo.webp", local: true },
  },
];
