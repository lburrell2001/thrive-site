export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';

type Ctx = { params: Promise<{ id: string }> };

const SERVICE_SLUGS = Object.keys(SERVICE_SEO) as [ServiceSlug, ...ServiceSlug[]];

// The reviewer's words and rating are theirs; admin decides where and
// whether they show, not what they say.
const updateSchema = z
  .object({
    status: z.enum(['submitted', 'approved', 'hidden']),
    service_slug: z.enum(SERVICE_SLUGS).nullable(),
    featured: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

function refreshServicePages() {
  for (const service of Object.values(SERVICE_SEO)) revalidatePath(service.path);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db.from('reviews').update(parsed.data).eq('id', id).select('id, status').maybeSingle();
  if (error) {
    if (error.message.includes('reviews_approved_needs_consent')) {
      return badRequest('This client did not agree to be quoted on the website, so it cannot be published.');
    }
    return badRequest(error.message);
  }
  if (!data) return badRequest('Review not found', 404);
  refreshServicePages();
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('reviews').delete().eq('id', id);
  if (error) return badRequest(error.message);
  refreshServicePages();
  return NextResponse.json({ ok: true, data: null });
}
