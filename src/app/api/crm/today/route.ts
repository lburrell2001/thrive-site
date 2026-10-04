export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadToday } from '@/lib/crmRepo';

/** Replies to answer, follow-ups due, new inquiries, deals gone quiet. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadToday(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load today', 500);
  }
}
