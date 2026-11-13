export const runtime = 'nodejs';

// The client accepts an estimate (no login needed): recorded (who, when, from
// where), marked accepted — which wins the deal. If they already have a portal,
// it becomes an invoice in their project folder; if not, Lauren is asked to set
// up their portal (src/lib/acceptedPortal.ts). Lauren is texted and emailed.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { loadClientEstimate } from '@/lib/estimateAccess';
import { proposalServiceClient } from '@/lib/proposalAccess';
import { afterAccept } from '@/lib/acceptedPortal';
import { parseIpAddress } from '@/lib/proposalSignature';
import { textAgency } from '@/lib/sms';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';
import { hasChoices, isPhased, lineSelectionSchema, tiersOf } from '@/lib/lineItems';
import { cleanPhases, recordPhaseApproval, tellPhasesApproved } from '@/lib/phaseApproval';
import { choiceTotal } from '@/lib/estimateChoice';

const schema = z.object({
  token: z.string().min(10).max(128),
  name: z.string().trim().min(1, 'Type your name to accept').max(160),
  agreed: z.literal(true, { message: 'Tick the box to accept' }),
  /** Tiers and extras (migration 061): the option and extras they picked. */
  selection: lineSelectionSchema.optional(),
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
    // Phases (migration 062): the phases they approve — no invoice; Lauren makes the estimate for them.
    if (isPhased(est.line_items)) {
      const phases = cleanPhases(est.line_items, parsed.data.selection?.phases);
      if (!phases.length) return NextResponse.json({ error: 'Tick at least one phase to approve.' }, { status: 400 });
      const { error } = await recordPhaseApproval(db, id, phases, { name: parsed.data.name, ip: parseIpAddress(req.headers.get('x-forwarded-for')) });
      if (error) return NextResponse.json({ error: 'We couldn’t record that. Please try again.' }, { status: 500 });
      after(() => tellPhasesApproved({
        who: parsed.data.name, what: `estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''}`,
        estimateId: id, lines: est.line_items, phases,
      }));
      return NextResponse.json({ ok: true, phased: true, phases, invoiceReady: false, needsSetup: false });
    }
    // With tiers they must have picked one (nothing is preselected on the page).
    const tiers = tiersOf(est.line_items);
    if (tiers.length && !tiers.includes(parsed.data.selection?.tier ?? '')) {
      return NextResponse.json({ error: 'Choose an option before accepting.' }, { status: 400 });
    }
    // Their choice of option and extras, and its total (which the deal and invoice follow).
    const choice = hasChoices(est.line_items) ? choiceTotal(est.line_items, parsed.data.selection) : null;
    if (choice) {
      const { error: selErr } = await db.from('estimates').update({ selection: choice.selection, total_cents: choice.total_cents }).eq('id', id);
      if (selErr) {
        console.error('[estimate accept] selection not saved', id, selErr.message);
        return NextResponse.json({ error: 'We couldn’t record your choice. Please try again.' }, { status: 500 });
      }
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

  // Already approved phases: nothing more happens here.
  if (isPhased(est.line_items)) return NextResponse.json({ ok: true, phased: true, invoiceReady: false, needsSetup: false });

  // The invoice in their project folder if they have a portal (once, however many
  // times this runs); otherwise it waits for Lauren to set the portal up.
  const next = await afterAccept(db, id);
  if (next.error) console.error('[estimate accept] invoice not made', id, next.error);
  const setupUrl = `${SITE_URL}/admin#portal-accepted`;

  if (!est.accepted_at) {
    after(async () => {
      const total = formatLineMoney(est.total_cents);
      await textAgency(next.needsSetup
        ? `Accepted: estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} by ${parsed.data.name} — ${total}. Set up their portal: ${setupUrl}`
        : `Accepted: estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} by ${parsed.data.name} — ${total}. ${SITE_URL}/admin/invoices?estimate=${id}`);
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.CONTACT_NOTIFY_FROM;
      const to = process.env.CONTACT_NOTIFY_TO;
      if (apiKey && from && to) {
        await new Resend(apiKey).emails.send({
          from, to,
          subject: `Accepted: estimate ${est.estimate_number} — ${total}`,
          text: `${parsed.data.name} accepted estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''} for ${total}.\n\n${next.needsSetup
            ? `They don’t have a client portal yet. Set it up from Home (one click makes their login, the project and the invoice, and emails them):\n${setupUrl}`
            : next.invoiceReady ? 'The invoice is in their portal and they’ve been told.' : `The invoice wasn’t made automatically: ${next.error}`}\n\n${SITE_URL}/admin/invoices?estimate=${id}`,
        }).catch((e) => console.error('[estimate accept] notify failed', e));
      }
    });
  }

  return NextResponse.json({ ok: true, invoiceReady: next.invoiceReady, needsSetup: next.needsSetup, portalPath: '/portal/invoices' });
}
