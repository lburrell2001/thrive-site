import type { ServiceSlug } from '@/lib/serviceSeo';

export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_path: string | null;
  cover_alt: string | null;
  target_query: string | null;
  service_slug: ServiceSlug | null;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A post in lists, without the body. */
export type JournalPostSummary = Omit<JournalPost, 'body'> & { reading_minutes: number };
