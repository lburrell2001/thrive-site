export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { addProspects, addProspectsSchema, loadProspects } from '@/lib/prospectList';

/** Everyone on the Prospects list, with how often they've been emailed. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadProspects(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load prospects', 500);
  }
}

/** Add one or many prospects (pasted from a spreadsheet). */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = addProspectsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = typeof issue?.path[1] === 'number' ? ` (row ${issue.path[1] + 1})` : '';
    return badRequest(`${issue?.message ?? 'Invalid request'}${row}`);
  }
  try {
    return NextResponse.json({ ok: true, data: await addProspects(auth.db, parsed.data) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not add prospects');
  }
}
