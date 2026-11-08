export const runtime = 'nodejs';

// Clients → Questionnaires: the list, and creating or duplicating one.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { QuestionnaireError, createQuestionnaire, duplicateQuestionnaire, listQuestionnaires } from '@/lib/questionnaireRepo';
import { SERVICE_TYPES, type ServiceType } from '@/lib/questionnaires';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: { questionnaires: await listQuestionnaires(auth.db) } });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().trim().min(1).max(160),
    service_type: z.enum(Object.keys(SERVICE_TYPES) as [ServiceType, ...ServiceType[]]),
  }),
  z.object({ action: z.literal('duplicate'), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Give it a title and a service');
  try {
    const id = parsed.data.action === 'create'
      ? await createQuestionnaire(auth.db, parsed.data)
      : await duplicateQuestionnaire(auth.db, parsed.data.id);
    return NextResponse.json({ ok: true, data: { id } });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof QuestionnaireError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
