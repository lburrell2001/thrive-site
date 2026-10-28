import { NextRequest, NextResponse, after } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { trackPaidSession } from '@/lib/opinlyStripe';
import { markInvoicePaid } from '@/lib/invoicePayment';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

// The portal's return page calls this so a paid invoice shows as paid right
// away; the Stripe webhook does the same thing and is the fallback. Both go
// through markInvoicePaid, which checks the amount Stripe actually collected.
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('[stripe] confirm: STRIPE_SECRET_KEY missing');
    return NextResponse.json({ error: 'Payments are unavailable right now.' }, { status: 500 });
  }

  let sessionId = '';
  try {
    ({ sessionId = '' } = (await req.json()) as { sessionId?: string });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' as never });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed.', paid: false }, { status: 402 });
    }

    const result = await markInvoicePaid(getServiceClient(), session);
    if (!result.ok) return NextResponse.json({ error: 'Could not confirm this payment.', paid: false }, { status: 400 });

    after(() => trackPaidSession(session, result.invoiceId));
    return NextResponse.json({ paid: true, invoiceId: result.invoiceId });
  } catch (err: unknown) {
    console.error('[stripe] confirm failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not confirm this payment.' }, { status: 500 });
  }
}
