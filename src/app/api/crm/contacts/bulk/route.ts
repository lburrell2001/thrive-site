export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { BulkError, bulkSchema, runBulk } from '@/lib/crmBulk';

/** Delete contacts, or move them to Leads / Prospects. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  try {
    return NextResponse.json({ ok: true, data: await runBulk(auth.db, parsed.data) });
  } catch (error) {
    if (error instanceof BulkError) return badRequest(error.message);
    throw error;
  }
}
