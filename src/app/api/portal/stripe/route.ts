import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' as never });

  try {
    const { invoiceId, amount, description } = (await req.json()) as {
      invoiceId: string;
      amount: number;
      description: string;
    };

    if (!invoiceId || !amount || !description) {
      return NextResponse.json(
        { error: 'invoiceId, amount, and description are required.' },
        { status: 400 }
      );
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100), // convert dollars to cents
            product_data: { name: description },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/portal/invoices?paid=true`,
      cancel_url: `${origin}/portal/invoices?cancelled=true`,
      metadata: { invoiceId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
