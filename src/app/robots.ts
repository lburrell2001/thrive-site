import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://thrivecreativestudios.org/sitemap.xml",
    host: "https://thrivecreativestudios.org",
  };
}
