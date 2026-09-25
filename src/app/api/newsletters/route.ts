export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

/** Every newsletter, newest first. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db
    .from('newsletters')
    .select('id, subject, audience, audience_tag, status, recipient_count, sent_at, updated_at, last_error')
    .order('updated_at', { ascending: false });
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

/** Start a draft. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db.from('newsletters').insert({ subject: '' }).select('id').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
