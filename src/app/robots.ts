import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Logins, private client pages and endpoints: nothing to index.
      // Proposals (/p/) are left crawlable on purpose — they carry noindex,
      // and a crawler blocked here would never see it.
      disallow: ["/admin", "/portal", "/api/"],
    },
    sitemap: "https://thrivecreativestudios.org/sitemap.xml",
    host: "https://thrivecreativestudios.org",
  };
}
