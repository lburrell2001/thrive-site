export const runtime = 'nodejs';

// A client accepts or declines one of their invoices (migration 058).
// Accept: they agree to it (who and when) and pay as usual. Decline: with a
// reason; Pay is hidden, reminders and the overdue sweep skip it, until
// Lauren reopens it from the Client tab. Either way Lauren is emailed and
// texted, and it's logged on their activity and CRM timeline.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import { tellLauren } from '@/lib/agencyNotify';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('decline'), reason: z.string().trim().min(1, 'Tell us briefly why').max(2000) }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const db = auth.db;

  const { data: inv } = await db.from('portal_invoices').select('*').eq('id', id).maybeSingle();
  if (!inv || inv.client_id !== auth.user.id) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (inv.status === 'paid' || inv.deposit_paid_at) return NextResponse.json({ error: 'This invoice has already been paid.' }, { status: 409 });
  if (inv.declined_at) return NextResponse.json({ error: 'You’ve already declined this invoice.' }, { status: 409 });

  const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', auth.user.id).maybeSingle();
  const who = client?.full_name || auth.user.email || 'The client';
  const now = new Date().toISOString();
  const body = parsed.data;

  if (body.action === 'accept') {
    if (inv.accepted_at) return NextResponse.json({ ok: true });
    const { error } = await db.from('portal_invoices').update({ accepted_at: now, accepted_by: who }).eq('id', id);
    if (error) return NextResponse.json({ error: 'We couldn’t record that. Please try again.' }, { status: 500 });
  } else {
    const { error } = await db.from('portal_invoices').update({ declined_at: now, decline_reason: body.reason }).eq('id', id);
    if (error) return NextResponse.json({ error: 'We couldn’t record that. Please try again.' }, { status: 500 });
  }

  after(async () => {
    const total = formatLineMoney(inv.amount_cents);
    const what = body.action === 'accept' ? 'Accepted' : 'Declined';
    await db.from('portal_activity').insert({
      client_id: auth.user.id, project_name: inv.project_name ?? null, dot_color: body.action === 'accept' ? '#0cf574' : '#e40586',
      text: body.action === 'accept' ? `You accepted invoice ${inv.invoice_number}` : `You declined invoice ${inv.invoice_number}`,
    });
    const { data: contact } = await db.from('crm_contacts').select('id').eq('portal_client_id', auth.user.id).maybeSingle();
    if (contact) {
      await db.from('crm_activities').insert({
        contact_id: contact.id, kind: 'note', ...(inv.crm_deal_id ? { deal_id: inv.crm_deal_id } : {}),
        body: body.action === 'accept' ? `Accepted invoice ${inv.invoice_number} (${total})` : `Declined invoice ${inv.invoice_number} (${total}): “${body.reason}”`,
        metadata: { invoice_id: id, [body.action === 'accept' ? 'accepted' : 'declined']: true },
      });
    }
    const link = `${SITE_URL}/admin/clients?client=${auth.user.id}`;
    await tellLauren(
      `${what}: invoice ${inv.invoice_number} — ${total}`,
      body.action === 'accept'
        ? `${who}${client?.company_name ? ` (${client.company_name})` : ''} accepted invoice ${inv.invoice_number} for ${total}.\n\n${link}`
        : `${who}${client?.company_name ? ` (${client.company_name})` : ''} declined invoice ${inv.invoice_number} for ${total}.\n\nTheir reason: ${body.reason}\n\nPay is hidden and reminders are off until you reopen it on their Client tab.\n${link}`,
      body.action === 'accept' ? undefined : `Declined: invoice ${inv.invoice_number} by ${who}. “${body.reason.slice(0, 120)}” ${link}`,
    );
  });
  return NextResponse.json({ ok: true });
}
