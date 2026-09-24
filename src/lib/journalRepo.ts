// Public reads of the journal, with the anon key: RLS only returns
// published posts whose date has come.

import { supabase } from '@/lib/supabaseServer';
import { readingMinutes } from '@/lib/articleMarkdown';
import type { JournalPost, JournalPostSummary } from '@/types/journal';

const SUMMARY_COLUMNS = 'id, slug, title, excerpt, body, cover_path, cover_alt, target_query, service_slug, tags, status, published_at, created_at, updated_at';

export async function publishedPosts(limit = 60): Promise<JournalPostSummary[]> {
  const { data } = await supabase
    .from('journal_posts')
    .select(SUMMARY_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(limit) as { data: JournalPost[] | null };
  return (data ?? []).map(({ body, ...post }) => ({ ...post, reading_minutes: readingMinutes(body) }));
}

export async function publishedPost(slug: string): Promise<JournalPost | null> {
  const { data } = await supabase
    .from('journal_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle() as { data: JournalPost | null };
  return data;
}

export function formatPostDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
}
