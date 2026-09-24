// The editor's search checklist. Each check is something that makes an
// article more likely to be found for the search it was written for —
// guidance, not rules: publishing is never blocked by it.

import { articleText, parseArticle } from '@/lib/articleMarkdown';
import type { JournalPost } from '@/types/journal';

export interface Check {
  id: string;
  ok: boolean;
  label: string;
  hint: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** True if most words of the phrase appear, in any order. */
function mentions(haystack: string, phrase: string) {
  const words = norm(phrase).split(' ').filter((w) => w.length > 2);
  if (!words.length) return false;
  const text = ` ${norm(haystack)} `;
  const found = words.filter((w) => text.includes(` ${w}`)).length;
  return found / words.length >= 0.75;
}

export function journalChecklist(post: Pick<JournalPost, 'title' | 'excerpt' | 'body' | 'target_query' | 'service_slug' | 'cover_path' | 'cover_alt'>): Check[] {
  const blocks = parseArticle(post.body);
  const text = articleText(post.body);
  const words = text.split(/\s+/).filter(Boolean).length;
  const firstParagraph = blocks.find((b) => b.kind === 'p');
  const headings = blocks.filter((b) => b.kind === 'h2').length;
  const internalLinks = (post.body.match(/\]\(\/[^)\s]*\)/g) ?? []).length;
  const q = post.target_query?.trim() ?? '';
  const excerptLen = post.excerpt.trim().length;

  return [
    {
      id: 'query',
      ok: Boolean(q),
      label: 'Target search chosen',
      hint: 'Write down the exact search you want this to show up for, e.g. "how much does a logo cost in Dallas".',
    },
    {
      id: 'title',
      ok: Boolean(q) && mentions(post.title, q),
      label: 'Title uses the search',
      hint: 'Put the search words in the title — it is the biggest signal Google reads.',
    },
    {
      id: 'intro',
      ok: Boolean(q) && Boolean(firstParagraph && 'text' in firstParagraph && mentions(firstParagraph.text, q)),
      label: 'First paragraph answers it',
      hint: 'Answer the question in the first paragraph, using the same words. Readers and Google both decide there.',
    },
    {
      id: 'excerpt',
      ok: excerptLen >= 110 && excerptLen <= 160,
      label: `Summary is 110–160 characters (${excerptLen})`,
      hint: 'This is the text under your link on Google. Shorter wastes space; longer gets cut off.',
    },
    {
      id: 'length',
      ok: words >= 600,
      label: `At least 600 words (${words})`,
      hint: 'Articles that fully answer a question rank better than quick notes. 800–1,500 is a good range.',
    },
    {
      id: 'headings',
      ok: headings >= 2,
      label: 'Split into sections with ## headings',
      hint: 'Two or more ## headings help readers skim and help Google understand what each part covers.',
    },
    {
      id: 'links',
      ok: internalLinks >= 2,
      label: `Links to 2+ of your own pages (${internalLinks})`,
      hint: 'Link to a service page and a related project, e.g. [brand design](/services/brand-design). It passes the article\'s traffic to pages that convert.',
    },
    {
      id: 'service',
      ok: Boolean(post.service_slug),
      label: 'Related service chosen',
      hint: 'The article ends with a call to action for this service.',
    },
    {
      id: 'cover',
      ok: Boolean(post.cover_path && post.cover_alt?.trim()),
      label: 'Cover image with a description',
      hint: 'Used when the article is shared, and the description is read by screen readers and Google Images.',
    },
  ];
}
