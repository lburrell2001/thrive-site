export const runtime = 'nodejs';
// A due newsletter waits between batches; give a large list room to finish.
export const maxDuration = 300;

// Scheduled emails, called by Vercel Cron every five minutes with
// Authorization: Bearer ${CRON_SECRET}. See vercel.json.

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { sendDueEmails } from '@/lib/scheduledEmails';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendDueEmails(serviceClient(), resolveSiteOrigin(req));
  return NextResponse.json(result);
}
