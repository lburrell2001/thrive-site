export const runtime = 'nodejs';

// A client changes their sign-in / contact email from the portal welcome:
// `send` emails a 6-digit code to the new address, `verify` checks it and then
// switches the address (auth user + their CRM contact). The code is made and
// checked here, not by Supabase's email-change flow, so it doesn't depend on
// the project's "secure email change" setting: only a hash is kept, on the
// user's app_metadata (which only the service role can write), for 15 minutes
// and 5 tries. One code a minute, and the connection-level limit in rateLimit.

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import { brandEmail, esc, paragraph } from '@/lib/emailLayout';
import { allow } from '@/lib/rateLimit';

const TTL_MS = 15 * 60_000;
const WAIT_MS = 60_000;
const MAX_TRIES = 5;

type Pending = { email: string; hash: string; expires: number; sent_at: number; tries: number };

const hashOf = (code: string, userId: string) => createHash('sha256').update(`${userId}:${code}`).digest('hex');

function codeEmail(code: string) {
  return brandEmail({
    title: 'Confirm your new email',
    preheader: `Your code is ${code}`,
    heading: 'Confirm your email',
    body: [
      paragraph('Enter this code in your Thrive client portal to use this address for sign-in and updates:'),
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr><td style="background:#f5f4f1;border-radius:12px;padding:18px 28px;font-family:'Bungee','Arial Black',Impact,sans-serif;font-size:34px;letter-spacing:.18em;color:#0a0a0a;">${esc(code)}</td></tr></table>`,
      paragraph('It works for 15 minutes. If you did not ask for this, you can ignore this email.', { size: 13, color: '#737373' }),
    ].join('\n'),
  });
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send'), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal('verify'), code: z.string().trim().regex(/^\d{6}$/) }),
]);

export async function POST(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { db, user } = auth;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const body = parsed.data;

  // Fresh copy: the token's metadata can be stale.
  const { data: fresh } = await db.auth.admin.getUserById(user.id);
  const meta = (fresh.user?.app_metadata ?? {}) as Record<string, unknown>;
  const pending = meta.email_change as Pending | undefined;

  if (body.action === 'send') {
    if (body.email === (fresh.user?.email ?? '').toLowerCase()) {
      return NextResponse.json({ error: 'That’s already your email.' }, { status: 400 });
    }
    if (pending && Date.now() - pending.sent_at < WAIT_MS && pending.email === body.email) {
      return NextResponse.json({ error: 'We just sent a code. Give it a minute before asking for another.' }, { status: 429 });
    }
    if (!(await allow(db, req, 'portal_email_change', 5, 15 * 60_000))) {
      return NextResponse.json({ error: 'Too many tries. Try again in 15 minutes.' }, { status: 429 });
    }
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (list?.users.some((u) => u.id !== user.id && (u.email ?? '').toLowerCase() === body.email)) {
      return NextResponse.json({ error: 'That email is already used by another account.' }, { status: 409 });
    }
    const key = process.env.RESEND_API_KEY;
    const from = process.env.CONTACT_NOTIFY_FROM;
    if (!key || !from) return NextResponse.json({ error: 'Email isn’t set up. Contact your Thrive team.' }, { status: 500 });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const next: Pending = { email: body.email, hash: hashOf(code, user.id), expires: Date.now() + TTL_MS, sent_at: Date.now(), tries: 0 };
    await db.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, email_change: next } });
    const { error } = await new Resend(key).emails.send({
      from,
      to: body.email,
      subject: 'Confirm your new email for Thrive',
      html: codeEmail(code),
      text: `Your Thrive confirmation code is ${code}\n\nEnter it in your client portal to use this address. It works for 15 minutes. If you did not ask for this, you can ignore this email.`,
    });
    if (error) return NextResponse.json({ error: 'We couldn’t send the code. Check the address and try again.' }, { status: 500 });
    return NextResponse.json({ ok: true, email: body.email });
  }

  // verify
  if (!pending || Date.now() > pending.expires) {
    return NextResponse.json({ error: 'That code has expired. Send a new one.' }, { status: 400 });
  }
  if (pending.tries >= MAX_TRIES) {
    return NextResponse.json({ error: 'Too many wrong codes. Send a new one.' }, { status: 429 });
  }
  const given = Buffer.from(hashOf(body.code, user.id), 'hex');
  const expected = Buffer.from(pending.hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await db.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, email_change: { ...pending, tries: pending.tries + 1 } } });
    return NextResponse.json({ error: 'That code isn’t right. Check the email and try again.' }, { status: 400 });
  }

  // app_metadata updates merge, so the used code is cleared with null.
  const { error } = await db.auth.admin.updateUserById(user.id, { email: pending.email, email_confirm: true, app_metadata: { ...meta, email_change: null } });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: taken ? 'That email is already used by another account.' : 'We couldn’t update your email. Try again.' }, { status: taken ? 409 : 500 });
  }
  // Keep their CRM contact in step (best effort: another contact may already have it).
  await db.from('crm_contacts').update({ email: pending.email }).eq('portal_client_id', user.id);
  return NextResponse.json({ ok: true, email: pending.email });
}
