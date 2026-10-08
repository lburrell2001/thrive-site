export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadVisitors } from '@/lib/siteVisitors';

/** People browsing the site over the last 30 days, for the Visitors page. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadVisitors(auth.db, 30) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load visitors', 500);
  }
}
