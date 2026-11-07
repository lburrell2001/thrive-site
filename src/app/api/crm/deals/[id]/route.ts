export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { updateDealSchema } from '@/lib/crmSchemas';
import { closeDeal, reopenDeal } from '@/lib/dealClose';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Rename, move stage, set value or lost reason. Stage changes are logged by trigger.
 * { closed: true | false } closes a won deal (off the pipeline, projects archived,
 * recurring invoices stopped) or reopens it (migration 045).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const raw = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (raw && typeof raw.closed === 'boolean' && Object.keys(raw).length === 1) {
    try {
      if (raw.closed) {
        const { data: deal } = await auth.db.from('crm_deals').select('stage').eq('id', id).maybeSingle();
        if (!deal) return badRequest('Deal not found', 404);
        if (deal.stage !== 'won') return badRequest('Only won deals can be closed. Move a deal that fell through to Lost.');
        await closeDeal(auth.db, id, 'manual');
      } else {
        await reopenDeal(auth.db, id);
      }
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Could not save');
    }
    const { data } = await auth.db.from('crm_deals').select('*').eq('id', id).maybeSingle();
    return NextResponse.json({ ok: true, data });
  }

  const parsed = updateDealSchema.safeParse(raw);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  // Moving a closed deal off Won puts it back in play.
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.stage && parsed.data.stage !== 'won') {
    const { data: cur } = await auth.db.from('crm_deals').select('closed_at').eq('id', id).maybeSingle();
    if (cur?.closed_at) { update.closed_at = null; update.closed_reason = null; }
  }

  const { data, error } = await auth.db
    .from('crm_deals')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Deal not found', 404);
  return NextResponse.json({ ok: true, data });
}

/**
 * Remove a deal. Its proposals and inquiries stay and simply stop pointing
 * at it; its stage history stays on the contact's timeline.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('crm_deals').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
