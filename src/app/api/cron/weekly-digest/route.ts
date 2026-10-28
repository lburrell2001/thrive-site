export const runtime = 'nodejs';

// Monday morning digest, called by Vercel Cron with
// Authorization: Bearer ${CRON_SECRET}. See vercel.json.

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { sendWeeklyDigest } from '@/lib/weeklyDigest';
import { cronAuthorized } from '@/lib/safeEquals';

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendWeeklyDigest(serviceClient(), resolveSiteOrigin(req));
  return NextResponse.json(result, { status: result.email === 'failed' ? 500 : 200 });
}
