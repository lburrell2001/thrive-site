import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // generateLink triggers Supabase to send the OTP email.
  // Wrap in a timeout so a misconfigured SMTP can't hang the request indefinitely.
  const linkPromise = admin.auth.admin.generateLink({ type: 'magiclink', email });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 12000)
  );

  let result: Awaited<typeof linkPromise>;
  try {
    result = await Promise.race([linkPromise, timeoutPromise]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'timeout') {
      return NextResponse.json(
        { error: 'Email send timed out. Check your Supabase SMTP settings.' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: 'Failed to send code.' }, { status: 500 });
  }

  const { error } = result;

  if (error) {
    // User not found → give a safe generic message
    const notFound = error.message.toLowerCase().includes('not found') || error.status === 422;
    return NextResponse.json(
      { error: notFound ? "We don't recognise that email. Contact your Thrive team to get set up." : error.message },
      { status: notFound ? 404 : 500 }
    );
  }

  return NextResponse.json({ sent: true });
}
