export const runtime = 'nodejs';

// One questionnaire: load it for the editor, save the whole thing, switch it
// on/off, or delete it (archived instead if any client has it).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { QuestionnaireError, deleteQuestionnaire, loadQuestionnaire, saveStructure } from '@/lib/questionnaireRepo';
import { QUESTION_TYPES, SERVICE_TYPES, type QuestionType, type ServiceType } from '@/lib/questionnaires';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Not found', 404);
  try {
    return NextResponse.json({ ok: true, data: { questionnaire: await loadQuestionnaire(auth.db, id) } });
  } catch (e) {
    return fail(e);
  }
}

const question = z.object({
  id: z.string().uuid().nullish(),
  prompt: z.string().trim().min(1, 'Every question needs a prompt').max(1000),
  help_text: z.string().max(2000).default(''),
  type: z.enum(Object.keys(QUESTION_TYPES) as [QuestionType, ...QuestionType[]]),
  options: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
  is_required: z.boolean(),
});
const structure = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).default(''),
  service_type: z.enum(Object.keys(SERVICE_TYPES) as [ServiceType, ...ServiceType[]]),
  is_active: z.boolean(),
  sections: z.array(z.object({
    id: z.string().uuid().nullish(),
    title: z.string().trim().min(1, 'Every section needs a title').max(200),
    description: z.string().max(2000).default(''),
    is_optional: z.boolean(),
    optional_label: z.string().max(300).default(''),
    questions: z.array(question).max(200),
  })).min(1, 'Keep at least one section').max(40),
});

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Not found', 404);
  const parsed = structure.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Check the questionnaire');
  const choiceWithoutOptions = parsed.data.sections.flatMap((s) => s.questions)
    .find((q) => ['single_choice', 'multi_choice', 'checkbox_list'].includes(q.type) && q.options.length < 2);
  if (choiceWithoutOptions) return badRequest(`“${choiceWithoutOptions.prompt.slice(0, 60)}” needs at least two options`);
  try {
    return NextResponse.json({ ok: true, data: { questionnaire: await saveStructure(auth.db, id, parsed.data) } });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = z.object({ is_active: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return badRequest('Bad request');
  const { error } = await auth.db.from('questionnaires').update({ is_active: parsed.data.is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return badRequest(error.message, 500);
  return NextResponse.json({ ok: true, data: {} });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Not found', 404);
  try {
    return NextResponse.json({ ok: true, data: { result: await deleteQuestionnaire(auth.db, id) } });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof QuestionnaireError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
