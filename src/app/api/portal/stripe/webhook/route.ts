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

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' as never });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.invoiceId) {
      // Checks the amount collected against the invoice before marking it paid.
      const result = await markInvoicePaid(getServiceClient(), session);
      if (result.ok) after(() => trackPaidSession(session, result.invoiceId));
      else console.error('[stripe] webhook did not mark invoice paid:', result.reason, session.id);
    }
  }

  return NextResponse.json({ received: true });
}
