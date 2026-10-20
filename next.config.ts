import type { NextConfig } from "next";

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
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
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

export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withPWA(nextConfig);