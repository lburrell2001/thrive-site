export const runtime = 'nodejs';

// Questionnaires assigned to clients: a client's list (?client=<portal id>),
// everything not yet submitted (?waiting=1, for Home), and assigning.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { QuestionnaireError, assignQuestionnaires, clientAssignments, waitingAssignments } from '@/lib/questionnaireRepo';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const client = url.searchParams.get('client');
  try {
    if (client) {
      if (!z.string().uuid().safeParse(client).success) return badRequest('Bad client');
      return NextResponse.json({ ok: true, data: { assignments: await clientAssignments(auth.db, client) } });
    }
    return NextResponse.json({ ok: true, data: { assignments: await waitingAssignments(auth.db) } });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().default(null),
  items: z.array(z.object({ questionnaireId: z.string().uuid(), optional: z.array(z.string().uuid()).default([]) })).min(1).max(20),
  notify: z.boolean().default(true),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Pick at least one questionnaire');
  try {
    return NextResponse.json({ ok: true, data: await assignQuestionnaires(auth.db, parsed.data) });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof QuestionnaireError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
