export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { createTaskSchema } from '@/lib/crmSchemas';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('crm_tasks')
    .insert({ contact_id: id, title: parsed.data.title, due_date: parsed.data.due_date ?? null })
    .select('*')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
