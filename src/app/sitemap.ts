import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@opinly/shared";
import { opinlyConfig } from "@opinly/next";
import { supabase } from "@/lib/supabaseServer";
import { opinly } from "@/lib/opinly";

const SITE_URL = "https://thrivecreativestudios.org";

// Rebuilt hourly, so projects added or removed in the database show up
// without waiting for a deploy. Opinly's /api/opinly webhook also
// revalidates it the moment a blog post is published.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                            lastModified: now, changeFrequency: "weekly",  priority: 1.0  },
    { url: `${SITE_URL}/portfolio`,                   lastModified: now, changeFrequency: "weekly",  priority: 0.95 },
    { url: `${SITE_URL}/services`,                    lastModified: now, changeFrequency: "monthly", priority: 0.9  },
    { url: `${SITE_URL}/services/brand-design`,       lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/digital-design`,     lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/ux-design`,          lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/social-media`,       lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/services/photography`,        lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/amarillo-web-design`,         lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/about`,                       lastModified: now, changeFrequency: "monthly", priority: 0.8  },
    { url: `${SITE_URL}/contact`,                     lastModified: now, changeFrequency: "monthly", priority: 0.8  },
    { url: `${SITE_URL}/journal`,                     lastModified: now, changeFrequency: "weekly",  priority: 0.8  },
    { url: `${SITE_URL}/book`,                        lastModified: now, changeFrequency: "monthly", priority: 0.7  },
    { url: `${SITE_URL}/privacy`,                     lastModified: now, changeFrequency: "yearly",  priority: 0.3  },
    { url: `${SITE_URL}/sms`,                         lastModified: now, changeFrequency: "yearly",  priority: 0.3  },
  ];

  const { data } = await supabase
    .from("projects")
    .select("slug")
    .order("title", { ascending: true });

  type ProjectSlugRow = { slug: string };
  const projectRows: ProjectSlugRow[] = (data ?? []) as ProjectSlugRow[];

  const projectUrls: MetadataRoute.Sitemap = projectRows.map((project) => ({
    url: `${SITE_URL}/work/${project.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Published articles only — the anon key cannot see drafts.
  const { data: posts } = await supabase
    .from("journal_posts")
    .select("slug, updated_at")
    .order("published_at", { ascending: false });

  const postUrls: MetadataRoute.Sitemap = ((posts ?? []) as { slug: string; updated_at: string }[]).map((post) => ({
    url: `${SITE_URL}/journal/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  // The Opinly blog (/blog): posts flat, archives under their prefixes.
  // A failed fetch leaves the blog out rather than failing the sitemap.
  const blogUrls: MetadataRoute.Sitemap = await opinly
    .routes()
    .then((routes) =>
      buildSitemapEntries(routes, opinlyConfig).map((e) => ({
        url: e.url,
        lastModified: new Date(e.lastModified),
        changeFrequency: "monthly" as const,
        priority: e.url === `${SITE_URL}/blog` ? 0.8 : 0.75,
      })),
    )
    .catch((error) => {
      console.error("[sitemap] Opinly routes unavailable:", error instanceof Error ? error.message : error);
      return [];
    });

  return [...staticUrls, ...projectUrls, ...postUrls, ...blogUrls];
}
