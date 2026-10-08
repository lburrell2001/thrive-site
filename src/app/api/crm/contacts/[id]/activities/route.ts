export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { createActivitySchema } from '@/lib/crmSchemas';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Log a note, call, meeting or off-platform email. A call carries its
 * direction, outcome and length in metadata, can be dated in the past, and
 * can add a follow-up task. A call where you talked moves New lead deals to
 * Contacted, as an email does.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = createActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const { kind, body, at, deal_id, call, follow_up } = parsed.data;

  if (deal_id) {
    const { data: deal } = await auth.db.from('crm_deals').select('id').eq('id', deal_id).eq('contact_id', id).maybeSingle();
    if (!deal) return badRequest('That deal belongs to someone else');
  }

  const { data, error } = await auth.db
    .from('crm_activities')
    .insert({
      contact_id: id,
      kind,
      body,
      deal_id: deal_id ?? null,
      metadata: kind === 'call' && call ? { direction: call.direction, outcome: call.outcome, minutes: call.minutes ?? null } : {},
      ...(at ? { created_at: new Date(at).toISOString() } : {}),
    })
    .select('*')
    .single();
  if (error) return badRequest(error.message);

  if (follow_up) {
    await auth.db.from('crm_tasks').insert({ contact_id: id, title: follow_up.title, due_date: follow_up.due_date ?? null });
  }

  if (kind === 'call' && call?.outcome === 'connected') {
    const move = auth.db.from('crm_deals').update({ stage: 'contacted' }).eq('contact_id', id).eq('stage', 'lead');
    await (deal_id ? move.eq('id', deal_id) : move);
  }

  return NextResponse.json({ ok: true, data });
}
