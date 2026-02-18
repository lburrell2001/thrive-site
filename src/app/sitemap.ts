import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabaseServer";

const SITE_URL = "https://thrivecreativestudios.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${SITE_URL}/services/branding`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/web-ux`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/web-app-dev`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    {
      url: `${SITE_URL}/services/social-media-management`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/work`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  const { data } = await supabase
    .from("projects")
    .select("slug")
    .order("title", { ascending: true });

  type ProjectSlugRow = { slug: string };
  const projectRows: ProjectSlugRow[] = (data ?? []) as ProjectSlugRow[];

  const projectUrls: MetadataRoute.Sitemap =
    projectRows.map((project) => ({
      url: `${SITE_URL}/work/${project.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [...staticUrls, ...projectUrls];
}
