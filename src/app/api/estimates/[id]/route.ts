export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { planProblem } from '@/lib/paymentPlan';
import { totalCents } from '@/lib/lineItems';
import { estimatePatchSchema, estimateRow, missingTotalsOnly, withoutTotalsOnly } from '@/lib/estimates';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = estimatePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid estimate');
  if (Object.keys(parsed.data).length === 0) return badRequest('Nothing to update');

  // Pay over time (069): the payments add up to the total (the new lines', else the saved one).
  if (parsed.data.payment_plan) {
    let total = parsed.data.line_items ? totalCents(parsed.data.line_items) : null;
    if (total === null) {
      const { data: cur } = await auth.db.from('estimates').select('total_cents').eq('id', id).maybeSingle();
      if (!cur) return badRequest('Estimate not found', 404);
      total = cur.total_cents as number;
    }
    const problem = planProblem(parsed.data.payment_plan, total);
    if (problem) return badRequest(problem);
  }

  const row = { ...estimateRow(parsed.data), updated_at: new Date().toISOString() };
  const save = (r: Record<string, unknown>) => auth.db.from('estimates').update(r).eq('id', id).select('*').maybeSingle();
  let { data, error } = await save(row);
  // Before migration 047 / 064: save without the missing column(s).
  let trimmed: Record<string, unknown> = row;
  for (let i = 0; i < 2 && error && missingTotalsOnly(error.message); i++) {
    trimmed = withoutTotalsOnly(trimmed, error.message);
    ({ data, error } = await save(trimmed));
  }
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Estimate not found', 404);

  // A proposal's estimate: its payment terms are the proposal's deposit too
  // (pay over time → no deposit on the proposal; the plan prints with its estimate).
  if ('deposit_percent' in parsed.data || 'payment_plan' in parsed.data) {
    const pct = parsed.data.payment_plan ? 0 : Number(parsed.data.deposit_percent ?? 0);
    await auth.db.from('proposals').update({ deposit_percent: pct }).eq('estimate_id', id).neq('status', 'signed');
  }
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('estimates').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
