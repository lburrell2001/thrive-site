import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';

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

  const { data: invoice } = await db
    .from('portal_invoices')
    .select('id, client_id, invoice_number, project_name, amount_cents, status')
    .eq('id', invoiceId)
    .eq('client_id', user.id)
    .single();
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  if (invoice.status === 'paid') return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 409 });
  if (!(invoice.amount_cents > 0)) return NextResponse.json({ error: 'This invoice has no amount due.' }, { status: 400 });

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
            unit_amount: invoice.amount_cents,
            product_data: { name: `Invoice ${invoice.invoice_number} — ${invoice.project_name}` },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,
      success_url: `${origin}/portal/invoices?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/invoices?cancelled=true`,
      metadata: { invoiceId: invoice.id, clientId: user.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[stripe] checkout failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
