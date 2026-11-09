// A paid invoice (Stripe Checkout) as an Opinly purchase. Both the Stripe
// webhook and the portal's return-page confirm call this; Opinly dedupes on
// the invoice id, so the payment counts once whichever arrives first.

import 'server-only';
import type Stripe from 'stripe';
import { trackPurchase } from '@/lib/opinly';

export function trackPaidSession(session: Stripe.Checkout.Session, invoiceId: string): Promise<void> {
  if (session.payment_status !== 'paid' || !session.amount_total) return Promise.resolve();
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  // A deposit and its balance are two purchases; the whole invoice is one.
  const part = session.metadata?.part;
  const key = part && part !== 'full' ? `invoice-${invoiceId}-${part}` : `invoice-${invoiceId}`;
  return trackPurchase(key, session.amount_total, session.currency ?? 'usd', { email });
}
