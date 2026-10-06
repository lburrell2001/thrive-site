export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadCampaign, updateCampaignSchema } from '@/lib/marketing';

type Ctx = { params: Promise<{ id: string }> };

/** A print campaign: details, recipients and their outcomes, scans, inquiries. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const data = await loadCampaign(auth.db, id);
  if (!data) return badRequest('Campaign not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = updateCampaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const { error } = await auth.db.from('marketing_campaigns').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}

/** Delete the campaign and its recipient list and scans. Contacts and deals stay. */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { error } = await auth.db.from('marketing_campaigns').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
