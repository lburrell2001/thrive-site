export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { serviceClient } from '@/lib/adminAuth';
import { InboundError, handleInbound, type ReceivedEvent } from '@/lib/inboundEmail';

/**
 * Resend's webhook for received email (event `email.received`). Signed
 * with RESEND_WEBHOOK_SECRET; anything unsigned or mis-signed is refused.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const key = process.env.RESEND_API_KEY;
  if (!secret || !key) return NextResponse.json({ error: 'Inbound email is not set up' }, { status: 503 });

  // The signature covers the exact bytes sent, so read the raw body.
  const payload = await req.text();
  let event: ReceivedEvent;
  try {
    event = new Resend(key).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    }) as ReceivedEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const result = await handleInbound(serviceClient(), event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // A 500 makes Resend retry later, which is what we want for a hiccup.
    const message = error instanceof InboundError || error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
