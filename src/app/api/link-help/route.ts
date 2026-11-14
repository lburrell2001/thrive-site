export const runtime = 'nodejs';

// "Send me a fresh link" on a broken estimate/proposal page (src/lib/linkRecovery.ts).
// Public, rate-limited, and always answers the same way.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { proposalServiceClient } from '@/lib/proposalAccess';
import { allow } from '@/lib/rateLimit';
import { sendFreshLinks } from '@/lib/linkRecovery';

const schema = z.object({
  email: z.string().trim().email('Enter the email address it was sent to').max(254),
  path: z.string().max(300).regex(/^\/(e|p)\//).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const db = proposalServiceClient();
  if (!(await allow(db, req, 'link_help', 5, 3_600_000))) {
    return NextResponse.json({ error: 'Too many tries — please reply to the email it came in and I’ll send it to you.' }, { status: 429 });
  }
  after(() => sendFreshLinks(db, parsed.data.email, parsed.data.path ?? null).catch((e) => console.error('[link-help]', e)));
  return NextResponse.json({ ok: true });
}
