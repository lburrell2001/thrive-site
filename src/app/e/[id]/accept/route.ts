export const runtime = 'nodejs';

// The client accepts an estimate: recorded (who, when, from where), marked
// accepted — which wins the deal — and turned into an invoice in the project
// folder in their portal. Lauren is texted and emailed.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { loadClientEstimate } from '@/lib/estimateAccess';
import { proposalServiceClient } from '@/lib/proposalAccess';
import { invoiceForEstimate } from '@/lib/estimateInvoice';
import { parseIpAddress } from '@/lib/proposalSignature';
import { textAgency } from '@/lib/sms';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';

const schema = z.object({
  token: z.string().min(10).max(128),
  name: z.string().trim().min(1, 'Type your name to accept').max(160),
  agreed: z.literal(true, { message: 'Tick the box to accept' }),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const est = await loadClientEstimate(id, parsed.data.token);
  if (!est) return NextResponse.json({ error: 'This estimate link isn’t valid.' }, { status: 404 });
  const db = proposalServiceClient();

  if (!est.accepted_at) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    if (est.valid_until && est.valid_until < today && est.status !== 'accepted') {
      return NextResponse.json({ error: 'This estimate has expired. Reply to the email it came in and we’ll send a fresh one.' }, { status: 409 });
    }
    if (est.status === 'declined') {
      return NextResponse.json({ error: 'This estimate was marked declined. Reply to the email it came in and we’ll reopen it.' }, { status: 409 });
    }
    const { error } = await db.from('estimates').update({
      accepted_at: new Date().toISOString(),
      accepted_by: parsed.data.name,
      accepted_ip: parseIpAddress(req.headers.get('x-forwarded-for')),
      status: est.status === 'invoiced' ? 'invoiced' : 'accepted',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return NextResponse.json({ error: 'We couldn’t record that. Please try again.' }, { status: 500 });
  }

  // The invoice, in their project folder (once, however many times this runs).
  const invoice = await invoiceForEstimate(db, id);
  if (!invoice.ok) console.error('[estimate accept] invoice not made', id, invoice.error);

  if (!est.accepted_at) {
    after(async () => {
      const total = formatLineMoney(est.total_cents);
      await textAgency(`Accepted: estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} by ${parsed.data.name} — ${total}. ${SITE_URL}/admin/invoices?estimate=${id}`);
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.CONTACT_NOTIFY_FROM;
      const to = process.env.CONTACT_NOTIFY_TO;
      if (apiKey && from && to) {
        await new Resend(apiKey).emails.send({
          from, to,
          subject: `Accepted: estimate ${est.estimate_number} — ${total}`,
          text: `${parsed.data.name} accepted estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} for ${total}.\n\n${invoice.ok ? 'The invoice is in their portal and they’ve been told.' : `The invoice wasn’t made automatically: ${invoice.error}`}\n\n${SITE_URL}/admin/invoices?estimate=${id}`,
        }).catch((e) => console.error('[estimate accept] notify failed', e));
      }
    });
  }

  return NextResponse.json({ ok: true, invoiceReady: invoice.ok, portalPath: '/portal/invoices' });
}
