import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';
import { dueNow, PART_LABEL } from '@/lib/invoiceDeposit';

// Opens Stripe Checkout for one of the signed-in client's own invoices. The
// amount and description come from the database, never from the request, and
// the session carries the client id so the payment can only settle that
// client's invoice (see src/lib/invoicePayment.ts).
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !url || !serviceKey) {
    console.error('[stripe] checkout is not configured');
    return NextResponse.json({ error: 'Payments are unavailable right now.' }, { status: 500 });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let invoiceId = '';
  try {
    ({ invoiceId = '' } = (await req.json()) as { invoiceId?: string });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required.' }, { status: 400 });

  // Deposit columns exist once migration 048 is in.
  const pick = (cols: string) => db.from('portal_invoices').select(cols).eq('id', invoiceId).eq('client_id', user.id).single();
  let found = await pick('id, client_id, invoice_number, project_name, amount_cents, status, due_date, deposit_cents, deposit_due_date, deposit_paid_at, balance_open, declined_at');
  if (found.error) found = await pick('id, client_id, invoice_number, project_name, amount_cents, status, due_date, deposit_cents, deposit_due_date, deposit_paid_at, balance_open');
  if (found.error) found = await pick('id, client_id, invoice_number, project_name, amount_cents, status, due_date');
  const invoice = found.data as unknown as {
    id: string; invoice_number: string; project_name: string; amount_cents: number; status: string; due_date: string;
    deposit_cents?: number | null; deposit_due_date?: string | null; deposit_paid_at?: string | null; balance_open?: boolean | null;
    declined_at?: string | null;
  } | null;
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  // Only the part that's due now can be paid: the deposit, the balance once it's open, or the whole invoice.
  const due = dueNow(invoice);
  if (due.kind === 'paid') return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 409 });
  if (due.kind === 'held') return NextResponse.json({ error: 'The rest of this invoice isn’t ready to pay yet.' }, { status: 409 });
  if (due.kind === 'declined') return NextResponse.json({ error: 'You declined this invoice. Thrive will be in touch about it.' }, { status: 409 });
  if (!(due.cents > 0)) return NextResponse.json({ error: 'This invoice has no amount due.' }, { status: 400 });

  // Return to our own site only, never to a caller-supplied Origin.
  const origin = process.env.NODE_ENV === 'development' ? req.nextUrl.origin : SITE_URL;

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' as never });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: due.cents,
            product_data: {
              name: due.part === 'full'
                ? `Invoice ${invoice.invoice_number} — ${invoice.project_name}`
                : `${PART_LABEL[due.part]} — Invoice ${invoice.invoice_number} — ${invoice.project_name}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,
      success_url: `${origin}/portal/invoices?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/invoices?cancelled=true`,
      metadata: { invoiceId: invoice.id, clientId: user.id, part: due.part },
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[stripe] checkout failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
