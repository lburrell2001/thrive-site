export const runtime = 'nodejs';

// One of the signed-in client's questionnaires: load it, save an answer
// (autosave), upload or remove a file, and submit. Every action checks the
// questionnaire is theirs and still open (not submitted, or reopened).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import {
  QuestionnaireError, attachFile, loadAssignmentDetail, ownAssignment, removeFile, saveAnswer, signUpload, submitAssignment,
} from '@/lib/questionnaireRepo';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return json({ error: 'Not found' }, 404);
  try {
    const a = await ownAssignment(auth.db, id, auth.user.id);
    const detail = await loadAssignmentDetail(auth.db, a, false);
    // Clients don't need the snapshots: they see the current wording.
    const answers = Object.fromEntries(Object.entries(detail.answers).map(([k, v]) => [k, v.value]));
    return json({ assignment: detail.assignment, questionnaire: detail.questionnaire, answers });
  } catch (e) {
    return fail(e);
  }
}

const file = z.object({ name: z.string().min(1).max(300), size: z.number().int().positive(), type: z.string().max(200) });
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), questionId: z.string().uuid(), value: z.unknown() }),
  z.object({ action: z.literal('upload_url'), questionId: z.string().uuid(), file }),
  z.object({ action: z.literal('attach'), questionId: z.string().uuid(), file: file.extend({ path: z.string().min(1).max(500) }) }),
  z.object({ action: z.literal('remove_file'), questionId: z.string().uuid(), path: z.string().min(1).max(500) }),
  z.object({ action: z.literal('submit') }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return json({ error: 'Bad request' }, 400);
  try {
    const a = await ownAssignment(auth.db, id, auth.user.id);
    const body = parsed.data;
    switch (body.action) {
      case 'answer':
        await saveAnswer(auth.db, a, body.questionId, body.value);
        return json({ ok: true });
      case 'upload_url':
        return json({ ok: true, upload: await signUpload(auth.db, a, body.questionId, body.file) });
      case 'attach':
        await attachFile(auth.db, a, body.questionId, body.file);
        return json({ ok: true });
      case 'remove_file':
        await removeFile(auth.db, a, body.questionId, body.path);
        return json({ ok: true });
      case 'submit': {
        const r = await submitAssignment(auth.db, a);
        return r.ok ? json({ ok: true }) : json({ error: 'Some required questions still need an answer.', missing: r.missing }, 422);
      }
    }
  } catch (e) {
    return fail(e);
  }
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

function fail(e: unknown) {
  if (e instanceof QuestionnaireError) return json({ error: e.message }, e.status);
  return json({ error: 'Something went wrong. Try again.' }, 500);
}
