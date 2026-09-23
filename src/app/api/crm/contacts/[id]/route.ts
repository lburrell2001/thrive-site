export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadContactDetail } from '@/lib/crmRepo';
import { updateContactSchema } from '@/lib/crmSchemas';
import { normalizePhone } from '@/lib/phone';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const detail = await loadContactDetail(auth.db, id);
  if (!detail) return badRequest('Contact not found', 404);
  return NextResponse.json({ ok: true, data: detail });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = updateContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.phone !== undefined) {
    const phone = normalizePhone(parsed.data.phone);
    if (parsed.data.phone && !phone) return badRequest('Enter a valid phone number, e.g. (555) 123-4567');
    update.phone = phone;
  }

  const { data, error } = await auth.db
    .from('crm_contacts')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Contact not found', 404);
  return NextResponse.json({ ok: true, data });
}

/**
 * Remove the contact, its notes and tasks. Inquiries, proposals and the
 * portal account are left alone — they just stop pointing here.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('crm_contacts').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
