export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

/** The most recent prospect emails, with who they went to. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db
    .from('prospect_emails')
    .select('id, contact_id, email, subject, style, status, error, sent_at, crm_contacts ( name, company )')
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
