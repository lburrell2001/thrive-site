import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Endpoints: nothing to index. /admin, /portal, proposals (/p/) and
      // review links (/review/) are left crawlable on purpose: they carry
      // noindex, and a crawler blocked here would never see it.
      disallow: ["/api/"],
    },
    sitemap: "https://thrivecreativestudios.org/sitemap.xml",
    host: "https://thrivecreativestudios.org",
  };
}
