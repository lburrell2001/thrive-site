export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

/** Opening a contact counts as reading their new website inquiries. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db
    .from('contact_inquiries')
    .update({ status: 'read' })
    .eq('crm_contact_id', id)
    .eq('status', 'new');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
