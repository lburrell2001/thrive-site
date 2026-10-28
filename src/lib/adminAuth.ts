// Shared admin gate for the proposal API routes.
//
// The same check /api/admin performs: a passcode in the X-Admin-Passcode
// header, checked against the `passcode` row in admin_config (an scrypt hash)
// using the service role, with a lockout after repeated wrong guesses. There is deliberately no second
// mechanism — admin auth in this codebase is the passcode, and the proposal
// routes use it rather than inventing a Supabase Auth path alongside it.

import 'server-only';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { callerKey, recentHits, recordHit } from '@/lib/rateLimit';

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

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Shortest passcode change_passcode will accept. */
export const MIN_PASSCODE_LENGTH = 12;

// Lockout: this many wrong passcodes from one address in the window → 429
// until the window rolls past them. Kept in rate_limit_hits (migration 038);
// without it the check is skipped rather than locking anyone out.
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** The passcode as stored: `scrypt$<salt hex>$<hash hex>`. */
export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(passcode, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function passcodeMatches(stored: string, supplied: string): Promise<boolean> {
  if (stored.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(supplied, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  }
  // Older rows hold the passcode itself; they are hashed on the next good sign-in.
  return constantTimeEquals(stored, supplied);
}

// Admin pages make many requests at once, each carrying the passcode; a good
// one is remembered (as a hash, per server instance) for a few minutes so
// scrypt doesn't run on every call.
const verified = new Map<string, number>();
const VERIFIED_TTL_MS = 5 * 60 * 1000;

export type PasscodeCheck = 'ok' | 'bad' | 'locked';

/** Checks an admin passcode, with lockout after repeated failures. */
export async function checkAdminPasscode(db: SupabaseClient, req: Request, supplied: string): Promise<PasscodeCheck> {
  if (!supplied) return 'bad';
  const memo = createHash('sha256').update(supplied).digest('hex');
  const until = verified.get(memo);
  if (until && until > Date.now()) return 'ok';

  const who = callerKey(req);
  if ((await recentHits(db, 'admin_passcode', who, FAILURE_WINDOW_MS)) >= MAX_FAILURES) return 'locked';

  const { data } = await db.from('admin_config').select('value').eq('key', 'passcode').single();
  const stored = data?.value ? String(data.value) : '';
  if (stored && (await passcodeMatches(stored, supplied))) {
    verified.set(memo, Date.now() + VERIFIED_TTL_MS);
    if (!stored.startsWith('scrypt$')) {
      const hashed = await hashPasscode(supplied);
      await db.from('admin_config').update({ value: hashed, updated_at: new Date().toISOString() }).eq('key', 'passcode');
    }
    return 'ok';
  }

  await recordHit(db, 'admin_passcode', who);
  return 'bad';
}

/** Forget remembered passcodes, e.g. after the passcode changes. */
export function forgetVerifiedPasscodes() {
  verified.clear();
}

export function passcodeFailure(result: Exclude<PasscodeCheck, 'ok'>): NextResponse {
  return result === 'locked'
    ? NextResponse.json({ error: 'Too many wrong passcodes. Try again in 15 minutes.' }, { status: 429 })
    : NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
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

  const check = await checkAdminPasscode(db, req, supplied);
  if (check !== 'ok') return { ok: false, response: passcodeFailure(check) };

  return { ok: true, db };
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
