export const runtime = 'nodejs';

// One deal's subcontract job (076): read it (null when the deal isn't one),
// set the end client / notes, tick a step by hand, or stop treating it as one.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { STEPS } from '@/lib/subcontract';
import { SubcontractError, jobFor, removeJob, updateJob } from '@/lib/subcontractRepo';

type Ctx = { params: Promise<{ dealId: string }> };
const uuid = z.string().uuid();
const keys = STEPS.map((s) => s.key) as [string, ...string[]];

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { dealId } = await params;
  if (!uuid.safeParse(dealId).success) return badRequest('Bad deal');
  try {
    return NextResponse.json({ ok: true, data: { job: await jobFor(auth.db, dealId) } });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.object({
  end_client: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  step: z.object({ key: z.enum(keys), done: z.boolean() }).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { dealId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(dealId).success || !parsed.success) return badRequest('Bad request');
  try {
    const b = parsed.data;
    const job = await updateJob(auth.db, dealId, { ...b, step: b.step as { key: (typeof STEPS)[number]['key']; done: boolean } | undefined });
    return NextResponse.json({ ok: true, data: { job } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { dealId } = await params;
  if (!uuid.safeParse(dealId).success) return badRequest('Bad deal');
  try {
    await removeJob(auth.db, dealId);
    return NextResponse.json({ ok: true, data: {} });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof SubcontractError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
