export const runtime = 'nodejs';
export const maxDuration = 120;

// Reads new Outlook mail and Google Voice alerts into the CRM. Called by
// Vercel Cron every five minutes with Authorization: Bearer ${CRON_SECRET}.

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { syncOutlook } from '@/lib/outlookSync';
import { cronAuthorized } from '@/lib/safeEquals';

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncOutlook(serviceClient()));
  } catch (error) {
    // Recorded on the connection; Settings → Email shows it.
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 });
  }
}
