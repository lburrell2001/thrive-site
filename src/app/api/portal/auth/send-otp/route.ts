// Portal sign-in code: email, and a text too when the client has opted in.
//
// The code used to be sent by Supabase straight from the browser
// (signInWithOtp), which meant the site never saw it and could not text it.
// Now the server asks Supabase for the code without sending anything
// (admin.generateLink returns it as `email_otp`), then sends it itself: the
// email in the Thrive layout (same words as supabase/templates/portal-code.html)
// and a text to the client's mobile if `sms_opt_in` is on. The browser still
// verifies it with verifyOtp({ type: 'email' }).
//
// Supabase's own per-address rate limit doesn't apply to generateLink, so
// there is one here: one code per address per minute, stamped on the auth
// user's app_metadata (which only the service role can write).

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendSms, smsConfigured } from '@/lib/sms';
import { brandEmail, esc, paragraph } from '@/lib/emailLayout';

const WAIT_MS = 60_000;
const NOT_FOUND = "We don't recognise that email. Contact your Thrive team to get set up.";

function codeEmail(code: string): string {
  return brandEmail({
    title: 'Your Thrive sign-in code',
    preheader: `Your sign-in code is ${code}`,
    heading: 'Your sign-in code',
    body: [
      paragraph('Enter this code on the sign-in page to open your Thrive client portal:'),
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr><td style="background:#f5f4f1;border-radius:12px;padding:18px 28px;font-family:'Bungee','Arial Black',Impact,sans-serif;font-size:34px;letter-spacing:.18em;color:#0a0a0a;">${esc(code)}</td></tr></table>`,
      paragraph('If you did not ask to sign in, you can ignore this email.', { size: 13, color: '#737373' }),
    ].join('\n'),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length > 254) {
    return NextResponse.json({ error: 'Enter your email address.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (!url || !key || !resendKey || !from) {
    return NextResponse.json({ error: 'Sign-in is not set up. Contact your Thrive team.' }, { status: 500 });
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Find the login first, so the throttle is checked before a new code
  // replaces the one already sent. The client list is small.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return NextResponse.json({ error: 'Could not send a code. Try again.' }, { status: 500 });
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });

  const lastSent = Date.parse(String(user.app_metadata?.portal_code_sent_at ?? ''));
  if (Number.isFinite(lastSent) && Date.now() - lastSent < WAIT_MS) {
    return NextResponse.json(
      { error: 'A code was just sent. Wait a minute before asking for another.' },
      { status: 429 },
    );
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const code = link?.properties?.email_otp;
  if (linkError || !code) {
    console.error('Portal code: generateLink failed', linkError);
    return NextResponse.json({ error: 'Could not send a code. Try again.' }, { status: 500 });
  }

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, portal_code_sent_at: new Date().toISOString() },
  });

  const { data: profile } = await admin
    .from('portal_clients')
    .select('phone, sms_opt_in')
    .eq('id', user.id)
    .maybeSingle();
  const textIt = Boolean(profile?.phone && profile.sms_opt_in && smsConfigured());

  const [emailResult, smsResult] = await Promise.all([
    new Resend(resendKey).emails
      .send({
        from,
        to: email,
        subject: 'Your Thrive sign-in code',
        html: codeEmail(code),
        text: `Your Thrive sign-in code is ${code}\n\nEnter it on the sign-in page to open your client portal. If you did not ask to sign in, you can ignore this email.`,
      })
      .then((r) => !r.error)
      .catch(() => false),
    textIt
      ? sendSms(
          profile!.phone!,
          `Thrive Creative Studios: your client portal sign-in code is ${code}. Don't share it with anyone.\n\nReply STOP to opt out.`,
        )
      : Promise.resolve(null),
  ]);

  // They replied STOP at some point: record it, as every other sender does.
  if (smsResult && !smsResult.ok && smsResult.optedOut) {
    await admin.from('portal_clients').update({ sms_opt_in: false }).eq('id', user.id);
  }
  const texted = Boolean(smsResult?.ok);
  if (smsResult && !smsResult.ok) console.error('Portal code text failed:', smsResult.error);

  if (!emailResult && !texted) {
    return NextResponse.json({ error: 'Could not send a code. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ sent: true, email: emailResult, texted });
}
