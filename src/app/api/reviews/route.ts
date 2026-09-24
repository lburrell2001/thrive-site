export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import type { ReviewRow } from '@/types/review';

/** Every review and request, newest first, with who it came from. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('reviews')
    .select('id, crm_contact_id, crm_deal_id, service_slug, display_name, display_role, rating, body, consent_publish, status, featured, requested_at, submitted_at, approved_at, created_at, crm_contacts ( name ), crm_deals ( title )')
    .order('created_at', { ascending: false });
  if (error) return badRequest(error.message);

  const rows: ReviewRow[] = (data ?? []).map(({ crm_contacts, crm_deals, ...r }) => ({
    ...(r as Omit<ReviewRow, 'contact_name' | 'deal_title'>),
    contact_name: (crm_contacts as unknown as { name: string } | null)?.name ?? null,
    deal_title: (crm_deals as unknown as { title: string } | null)?.title ?? null,
  }));
  return NextResponse.json({ ok: true, data: rows });
}

const SERVICE_SLUGS = Object.keys(SERVICE_SEO) as [ServiceSlug, ...ServiceSlug[]];

const manualSchema = z.object({
  display_name: z.string().trim().min(1, 'Add the client\'s name').max(80),
  display_role: z.string().trim().max(120).optional().transform((v) => v || null),
  body: z.string().trim().min(10, 'Paste the testimonial').max(2000),
  rating: z.number().int().min(1).max(5).nullable(),
  service_slug: z.enum(SERVICE_SLUGS).nullable(),
  crm_contact_id: z.string().uuid().nullable(),
  // Testimonials received another way (email, text) still need the
  // client's permission before they go on the site.
  consent_publish: z.literal(true, { message: 'Confirm the client agreed to be quoted' }),
});

/** A testimonial received outside the review form, added by hand. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = manualSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('reviews')
    .insert({ ...parsed.data, status: 'submitted', submitted_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
