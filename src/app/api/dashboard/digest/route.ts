export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { sendWeeklyDigest } from '@/lib/weeklyDigest';

/** "Send me the weekly digest" on the admin home page. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const result = await sendWeeklyDigest(auth.db, resolveSiteOrigin(req));
  if (result.email !== 'sent' && result.sms !== 'sent') {
    return badRequest(result.error ?? 'The digest could not be sent', 500);
  }
  return NextResponse.json({ ok: true, data: result });
}
