export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { ProspectError, draftSchema, saveProspectDraft } from '@/lib/prospects';
import { scheduleProblem } from '@/lib/scheduleTime';

/** One-to-one emails not sent yet — saved or scheduled — soonest first. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db
    .from('prospect_drafts')
    .select('id, contact_id, subject, status, scheduled_at, error, updated_at, crm_contacts(name, email, company)')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

/** Save the draft for one person, optionally scheduled. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = draftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  if (parsed.data.scheduled_at) {
    const problem = scheduleProblem(new Date(parsed.data.scheduled_at));
    if (problem) return badRequest(problem);
  }
  try {
    const data = await saveProspectDraft(auth.db, parsed.data, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof ProspectError) return badRequest(error.message);
    throw error;
  }
}
