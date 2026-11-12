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
    slug: "digital-design", title: "Web Design & Development", name: "WEB DESIGN & DEVELOPMENT", tag: "01 — Web",
    sub: "DESIGNED AND BUILT BY ONE TEAM",
    desc: "We design and build: custom-coded from scratch, Shopify stores, or on WordPress, Wix or Squarespace when that fits — in your colors and fonts, never a template. Care plans keep it running after launch.",
    href: "/services/digital-design", tone: "pink",
    sticker: "/new-thrive/services/web-development.webp",
    media: { type: "image", src: "/new-thrive/services/web-development.webp", local: true },
  },
  {
    slug: "social-media", title: "Social Media", name: "SOCIAL MEDIA", tag: "02 — Social",
    sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "A content calendar, designed graphics, edited videos, captions and posting every month — and you approve everything before it goes out.",
    href: "/services/social-media", tone: "green",
    sticker: "/new-thrive/services/social-media.webp",
    media: { type: "video", src: "hero-social.mp4", poster: "/new-thrive/services/social-media.webp" },
  },
  {
    slug: "brand-design", title: "Brand & Graphic Design", name: "BRAND & GRAPHIC DESIGN", tag: "03 — Brand",
    sub: "YOUR BRAND, EVERYWHERE IT SHOWS UP",
    desc: "Logos and full identities built around your story — plus posters, event flyers, social graphics, menus, brochures and signage, all in your colors.",
    href: "/services/brand-design", tone: "blue",
    sticker: "/new-thrive/services/brand-design.webp",
    media: { type: "video", src: "thrive-hero-v2.mp4", poster: "/new-thrive/services/brand-design.webp" },
  },
  {
    slug: "photography", title: "Photography", name: "PHOTOGRAPHY", tag: "04 — Photo",
    sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Real images of your people, your product and your space — so you never need a stock photo standing in for you.",
    href: "/services/photography", tone: "black",
    sticker: "/new-thrive/services/photo.webp",
    media: { type: "image", src: "/new-thrive/services/photo.webp", local: true },
  },
];
