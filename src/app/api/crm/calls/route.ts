export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadCallLog } from '@/lib/crmRepo';

/** Logged calls and booked calls, for the CRM's Calls page. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadCallLog(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load calls', 500);
  }
}
