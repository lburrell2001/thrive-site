export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { buildAdminSummary } from '@/lib/adminSummary';

/** Everything the admin home page shows. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await buildAdminSummary(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load the dashboard', 500);
  }
}
