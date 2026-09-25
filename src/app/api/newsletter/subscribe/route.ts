export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serviceClient } from '@/lib/adminAuth';
import { NewsletterError, requestSubscription } from '@/lib/newsletter';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  name: z.string().trim().max(120).optional(),
  // Honeypot: real visitors never see or fill it.
  website: z.string().max(0).optional(),
});

/** Footer signup. Always answers the same way, so it can't reveal who is subscribed. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const honeypot = parsed.error.issues.some((i) => i.path[0] === 'website');
    // Bots get a success they can't learn from.
    if (honeypot) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter a valid email' }, { status: 400 });
  }
  try {
    await requestSubscription(serviceClient(), { email: parsed.data.email, name: parsed.data.name, source: 'footer' }, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Newsletter signup failed:', error);
    const message = error instanceof NewsletterError ? 'Signups are unavailable right now — please try again later.' : 'Something went wrong — please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
