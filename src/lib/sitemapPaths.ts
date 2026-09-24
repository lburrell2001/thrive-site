import 'server-only';
import sitemap from '@/app/sitemap';

/**
 * Paths from the sitemap that should be getting visits. Legal pages are
 * there to exist, not to be visited, so they are left out.
 */
export async function sitemapPaths(): Promise<string[]> {
  try {
    return (await sitemap())
      .map((entry) => new URL(entry.url).pathname)
      .filter((path) => !/^\/(privacy|sms)$/.test(path));
  } catch {
    return [];
  }
}
