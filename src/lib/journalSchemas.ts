import { z } from 'zod';

const SERVICE_SLUGS = ['brand-design', 'digital-design', 'ux-design', 'social-media', 'photography'] as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'The address needs at least 3 characters')
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

export const createPostSchema = z.object({
  title: z.string().trim().min(3, 'Give the article a title').max(160),
});

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().transform((v) => (v ? v : null));

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    slug: slugSchema,
    excerpt: z.string().trim().max(300),
    body: z.string().max(100_000),
    cover_alt: nullableText(200),
    target_query: nullableText(120),
    service_slug: z.enum(SERVICE_SLUGS).nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    status: z.enum(['draft', 'published']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** "How much does a logo cost?" → "how-much-does-a-logo-cost" */
export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
    .replace(/-$/, '') || 'article';
}
