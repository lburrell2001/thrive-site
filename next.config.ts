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