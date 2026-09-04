// Shared admin gate for the proposal API routes.
//
// This is the same check /api/admin already performs: a passcode in the
// X-Admin-Passcode header, compared against the `passcode` row in
// admin_config using the service role. There is deliberately no second
// mechanism — admin auth in this codebase is the passcode, and the proposal
// routes use it rather than inventing a Supabase Auth path alongside it.

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export type AdminResult =
  | { ok: true; db: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function requireAdmin(req: Request): Promise<AdminResult> {
  const supplied = req.headers.get('X-Admin-Passcode') ?? '';
  if (!supplied) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let db: SupabaseClient;
  try {
    db = serviceClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 }),
    };
  }

  const { data } = await db.from('admin_config').select('value').eq('key', 'passcode').single();
  if (!data?.value || !constantTimeEquals(String(data.value), supplied)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 }),
    };
  }

  return { ok: true, db };
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
