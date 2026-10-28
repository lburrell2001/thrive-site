import type { NextConfig } from "next";
import { withOpinlyConfig } from "@opinly/next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // One canonical host. Vercel's domain settings already 308 www to the
      // apex before requests reach the app; this is the backup if that is
      // ever removed. It only goes www → apex, so it can't loop.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.thrivecreativestudios.org" }],
        destination: "https://thrivecreativestudios.org/:path*",
        permanent: true,
      },
      // Project pages live under /work; /portfolio is only the index.
      { source: "/portfolio/:slug", destination: "/work/:slug", permanent: true },
      // The homepage is served from app/newhomepage; keep its old address
      // from being indexed as a second copy of the homepage.
      { source: "/newhomepage", destination: "/", permanent: true },
      // The agency's own site was taken out of the portfolio (2026-10-11).
      { source: "/work/thrive-site", destination: "/portfolio", permanent: true },
      // Newsletters and prospect emails became one Emails area in the CRM.
      { source: "/admin/crm/newsletters", destination: "/admin/crm/emails", permanent: false },
      { source: "/admin/crm/newsletters/:id", destination: "/admin/crm/emails/:id", permanent: false },
      { source: "/admin/crm/prospecting", destination: "/admin/crm/emails?tab=templates", permanent: false },
      { source: "/admin/crm/prospecting/:id", destination: "/admin/crm/emails/templates/:id", permanent: false },
      // The proposal builder moved into the CRM.
      { source: "/admin/proposals", destination: "/admin/crm/proposals", permanent: false },
      { source: "/admin/proposals/:path*", destination: "/admin/crm/proposals/:path*", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Baseline security headers on every response. The CSP here only sets
        // the directives that can't break third-party scripts (GTM, Opinly,
        // Stripe, Vercel): no framing by other sites, no <base> hijacking, no
        // plugins. No upgrade-insecure-requests: Safari applies it to
        // http://localhost and the dev site loads without CSS; HSTS already
        // keeps the live site on https.
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        // Admin and the client portal carry a noindex meta tag from their
        // layouts; this covers crawlers that only read headers.
        source: "/:area(admin|portal)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Proposals are private documents behind a secret link. The noindex
        // meta tag in app/p/layout.tsx covers crawlers that render; this
        // covers the ones that only read headers.
        source: "/p/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, noimageindex",
          },
          {
            key: "Referrer-Policy",
            // Keeps the access token out of the Referer header on any
            // outbound click from inside the proposal.
            value: "no-referrer",
          },
        ],
      },
    ];
  },
};

// Opinly blog at /blog: sets the SDK's env vars (site URL and blog path are
// reported to Opinly from them) and rewrites /blog-images/* to the Opinly CDN
// (https://cdn.opinly.ai/qwgvML9pOi6gEoJeyhSXO).
const withOpinly = withOpinlyConfig({
  blogPath: "/blog",
  imagesPath: "/blog-images",
  companyName: "Thrive Creative Studios",
  cdnNamespace: "qwgvML9pOi6gEoJeyhSXO",
  siteUrl: "https://thrivecreativestudios.org",
});

export default process.env.NODE_ENV === "development"
  ? withOpinly(nextConfig)
  : withPWA(withOpinly(nextConfig));