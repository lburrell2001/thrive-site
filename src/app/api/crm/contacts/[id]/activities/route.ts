export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { createActivitySchema } from '@/lib/crmSchemas';

type Ctx = { params: Promise<{ id: string }> };

/** Log a note, call, meeting or off-platform email. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = createActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('crm_activities')
    .insert({ contact_id: id, ...parsed.data })
    .select('*')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
