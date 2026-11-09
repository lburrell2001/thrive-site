export const runtime = 'nodejs';

// "Send" a proposal: publish it, then email the client a button to it (from
// Lauren's Outlook when connected). The proposal page has their estimate in
// it, the PDF and "Approve and sign" at the bottom; signing makes the invoice.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { deliver, proposalClientContact, type Contact } from '@/lib/clientNotify';
import { publishProposal } from '@/lib/proposalPublish';
import { formatLineMoney } from '@/lib/lineItems';

type Ctx = { params: Promise<{ id: string }> };

/** Who it would go to, for the Send dialog. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: p } = await auth.db.from('proposals').select('client_id').eq('id', id).maybeSingle();
  if (!p) return badRequest('Proposal not found', 404);
  const contact = p.client_id ? await proposalClientContact(auth.db, p.client_id) : null;
  return NextResponse.json({ ok: true, data: { email: contact?.email ?? '', name: contact?.name ?? '' } });
}

const schema = z.object({ email: z.string().trim().email('Enter their email address'), note: z.string().max(2000).optional() });

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const published = await publishProposal(db, id);
  if (!published.ok) return badRequest(published.error, published.status);

  const { data: p } = await db.from('proposals').select('total_cents, deposit_percent, valid_until, crm_deal_id').eq('id', id).single();
  const found = published.clientId ? await proposalClientContact(db, published.clientId) : null;
  const contact: Contact = {
    ...(found ?? { portalClientId: null, proposalClientId: null, name: '', firstName: 'there', phone: null, smsOptIn: false, smsSource: null }),
    email: parsed.data.email,
  };
  const total = formatLineMoney(p!.total_cents);
  const until = p!.valid_until ? new Date(`${p!.valid_until}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const report = await deliver(db, contact, {
    subject: `Your proposal: ${published.title}`,
    eyebrow: 'Your proposal',
    headline: `Here’s your proposal for ${published.title}, with its estimate inside. At the bottom you can save it as a PDF or approve and sign it — your invoice will be ready in your portal straight away.`,
    detail: [`Proposal: ${published.title}`, `Total: ${total}`, p!.deposit_percent > 0 && p!.deposit_percent < 100 ? `Deposit to start: ${p!.deposit_percent}%` : null, until && `Good until: ${until}`].filter(Boolean).join('\n'),
    note: parsed.data.note?.trim() || null,
    ctaUrl: published.url,
    ctaLabel: 'Review & sign your proposal',
    sms: null,
  }, { email: true, sms: false }, { fromInbox: true });
  if (report.email.status !== 'sent') return badRequest(report.email.error ?? 'The email did not send');

  // On the contact's timeline.
  const { data: rec } = published.clientId ? await db.from('proposal_clients').select('crm_contact_id').eq('id', published.clientId).maybeSingle() : { data: null };
  if (rec?.crm_contact_id) {
    await db.from('crm_activities').insert({
      contact_id: rec.crm_contact_id, kind: 'email',
      body: `Sent proposal: ${published.title} (${total})`,
      metadata: { proposal_id: id, to: parsed.data.email },
      ...(p!.crm_deal_id ? { deal_id: p!.crm_deal_id } : {}),
    });
  }
  return NextResponse.json({ ok: true, data: { to: parsed.data.email, url: published.url } });
}
