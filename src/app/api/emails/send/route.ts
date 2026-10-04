export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { ProspectError, sendProspect, sendSchema } from '@/lib/prospects';

/** Send one prospect email (or a test of it to Lauren). */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  try {
    const data = await sendProspect(auth.db, parsed.data, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof ProspectError) return badRequest(error.message);
    throw error;
  }
}
