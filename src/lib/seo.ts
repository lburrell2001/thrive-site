import type { Metadata } from "next";

export const SITE_URL = "https://thrivecreativestudios.org";
export const SITE_NAME = "Thrive Creative Studios";
export const DEFAULT_OG_IMAGE = "/hero-thrive-desk.jpg";

export function absoluteUrl(path: string) {
  if (!path) return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata(args: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const { title, description, path, keywords } = args;
  const url = absoluteUrl(path);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, alt: `${SITE_NAME} preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}


/** The @id every page's structured data uses to point at the business. */
export const BUSINESS_ID = `${SITE_URL}/#business`;

/**
 * Serialize structured data for a <script type="application/ld+json">.
 * `<` is escaped so no string inside can close the script tag early.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
