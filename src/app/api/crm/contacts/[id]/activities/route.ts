export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { createActivitySchema } from '@/lib/crmSchemas';
import { DM_PLATFORM_LABEL } from '@/lib/social';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Log a note, call, meeting or off-platform email. A call carries its
 * direction, outcome and length in metadata, can be dated in the past, and
 * can add a follow-up task. A call where you talked moves New lead deals to
 * Contacted, as an email does.
 *
 * A DM (Instagram or Facebook) or a text (Google Voice, sent from the app
 * after the Text button opened it) is logged the same way. Sending one moves
 * New lead deals to Contacted; a reply is treated like an email reply: a
 * prospect with no open deal gets a New lead deal and leaves Prospects.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = createActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const { kind, body, at, deal_id, call, dm, text, follow_up } = parsed.data;
  // Back-dating is fine (logging a call from last week); the future isn't.
  if (at && Date.parse(at) > Date.now() + 5 * 60_000) return badRequest('That time hasn’t happened yet');
  // A text records the number it went to, as Google Voice alerts do.
  const phone = kind === 'text' && text
    ? (await auth.db.from('crm_contacts').select('phone').eq('id', id).maybeSingle()).data?.phone ?? null
    : null;

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
      metadata:
        kind === 'call' && call ? { direction: call.direction, outcome: call.outcome, minutes: call.minutes ?? null }
        : kind === 'dm' && dm ? { platform: dm.platform, direction: dm.direction }
        : kind === 'text' && text ? { direction: text.direction, phone }
        : {},
      ...(at ? { created_at: new Date(at).toISOString() } : {}),
    })
    .select('*')
    .single();
  if (error) return badRequest(error.message);

  if (follow_up) {
    await auth.db.from('crm_tasks').insert({ contact_id: id, title: follow_up.title, due_date: follow_up.due_date ?? null });
  }

  const reply = (kind === 'dm' && dm?.direction === 'received') || (kind === 'text' && text?.direction === 'received');
  if (reply) {
    await auth.db.from('crm_contacts').update({ replied_at: new Date().toISOString() }).eq('id', id);
    const { data: contact } = await auth.db.from('crm_contacts').select('prospect_status').eq('id', id).maybeSingle();
    if (contact?.prospect_status === 'prospect' && !deal_id) {
      const { data: open } = await auth.db.from('crm_deals').select('id').eq('contact_id', id).in('stage', ['lead', 'contacted', 'proposal']).limit(1);
      if (!open?.length) {
        await auth.db.from('crm_deals').insert({
          contact_id: id,
          title: dm ? `Replied on ${DM_PLATFORM_LABEL[dm.platform]}` : 'Replied by text',
          stage: 'lead',
          source: dm ? dm.platform : 'phone',
        });
      }
    }
  }

  if ((kind === 'call' && call?.outcome === 'connected') || (kind === 'dm' && dm?.direction === 'sent') || (kind === 'text' && text?.direction === 'sent')) {
    const move = auth.db.from('crm_deals').update({ stage: 'contacted' }).eq('contact_id', id).eq('stage', 'lead');
    await (deal_id ? move.eq('id', deal_id) : move);
  }

  return NextResponse.json({ ok: true, data });
}
