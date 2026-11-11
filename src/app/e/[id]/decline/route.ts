export const runtime = 'nodejs';

// The client declines an estimate from its page, with a reason (migration
// 058): marked declined (the deal stays where it is), logged on their CRM
// timeline, and Lauren is emailed and texted the reason.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { loadClientEstimate } from '@/lib/estimateAccess';
import { proposalServiceClient } from '@/lib/proposalAccess';
import { tellLauren } from '@/lib/agencyNotify';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';

const schema = z.object({
  token: z.string().min(10).max(128),
  reason: z.string().trim().min(1, 'Tell us briefly why, so we can learn from it').max(2000),
  name: z.string().trim().max(160).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const est = await loadClientEstimate(id, parsed.data.token);
  if (!est) return NextResponse.json({ error: 'This estimate link isn’t valid.' }, { status: 404 });
  if (est.accepted_at || est.status === 'invoiced') return NextResponse.json({ error: 'This estimate has already been accepted.' }, { status: 409 });
  if (est.status === 'declined') return NextResponse.json({ ok: true });

  const db = proposalServiceClient();
  const now = new Date().toISOString();
  const { error } = await db.from('estimates').update({
    status: 'declined', declined_at: now, declined_by: parsed.data.name || null, decline_reason: parsed.data.reason, updated_at: now,
  }).eq('id', id);
  if (error) return NextResponse.json({ error: 'We couldn’t record that. Please try again, or reply to the email it came in.' }, { status: 500 });

  after(async () => {
    const total = formatLineMoney(est.total_cents);
    const who = parsed.data.name || est.client_name || 'The client';
    const { data: row } = await db.from('estimates').select('crm_contact_id, crm_deal_id, portal_client_id').eq('id', id).maybeSingle();
    let contactId: string | null = row?.crm_contact_id ?? null;
    if (!contactId && row?.portal_client_id) contactId = (await db.from('crm_contacts').select('id').eq('portal_client_id', row.portal_client_id).maybeSingle()).data?.id ?? null;
    if (contactId) {
      await db.from('crm_activities').insert({
        contact_id: contactId, kind: 'note', ...(row?.crm_deal_id ? { deal_id: row.crm_deal_id } : {}),
        body: `Declined estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''}: “${parsed.data.reason}”`,
        metadata: { estimate_id: id, declined: true },
      });
    }
    const link = `${SITE_URL}/admin/invoices?estimate=${id}`;
    await tellLauren(
      `Declined: estimate ${est.estimate_number} — ${total}`,
      `${who} declined estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} for ${total}.\n\nTheir reason: ${parsed.data.reason}\n\n${link}`,
      `Declined: estimate ${est.estimate_number} by ${who}. “${parsed.data.reason.slice(0, 120)}” ${link}`,
    );
  });
  return NextResponse.json({ ok: true });
}
