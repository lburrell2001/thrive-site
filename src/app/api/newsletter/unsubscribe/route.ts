export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { unsubscribe } from '@/lib/newsletter';

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here from the
 * List-Unsubscribe header, and the unsubscribe page's button does too.
 * Deliberately POST-only — link scanners that prefetch GET URLs must not
 * unsubscribe people.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const ok = await unsubscribe(serviceClient(), token);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'This unsubscribe link is not valid' }, { status: 400 });
}
