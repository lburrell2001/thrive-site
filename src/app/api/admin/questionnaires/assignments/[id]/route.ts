export const runtime = 'nodejs';

// One client's questionnaire: the responses (with the question text they
// saw), reopening it, changing which optional sections they get, removing it.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { QuestionnaireError, assignmentForAdmin, reopenAssignment, setOptionalSections, unassign } from '@/lib/questionnaireRepo';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Not found', 404);
  try {
    const detail = await assignmentForAdmin(auth.db, id);
    const { data: client } = await auth.db.from('portal_clients').select('full_name, company_name').eq('id', detail.assignment.client_id).maybeSingle();
    const { data: crm } = await auth.db.from('crm_contacts').select('id').eq('portal_client_id', detail.assignment.client_id).maybeSingle();
    return NextResponse.json({ ok: true, data: { ...detail, client: { name: client?.full_name ?? '', company: client?.company_name ?? '', crm_contact_id: crm?.id ?? null } } });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('optional'), sections: z.array(z.string().uuid()).max(40) }),
]);

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return badRequest('Bad request');
  try {
    if (parsed.data.action === 'reopen') await reopenAssignment(auth.db, id);
    else await setOptionalSections(auth.db, id, parsed.data.sections);
    return NextResponse.json({ ok: true, data: {} });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Not found', 404);
  try {
    await unassign(auth.db, id);
    return NextResponse.json({ ok: true, data: {} });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof QuestionnaireError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
