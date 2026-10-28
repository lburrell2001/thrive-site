import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { buildSecurityReport, confirmChecklistItem } from '@/lib/securityReport';

// The Security dashboard: live checks, data inventory and the checklist.
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await buildSecurityReport(auth.db) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[security report]', e);
    return NextResponse.json({ error: 'Could not run the security checks' }, { status: 500 });
  }
}

/** Confirm (or clear) a checklist item: { id, confirmed }. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { id?: string; confirmed?: boolean };
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await confirmChecklistItem(auth.db, body.id, body.confirmed !== false);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save' }, { status: 400 });
  }
}
