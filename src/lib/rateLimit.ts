// A small rate limiter on Supabase (migration 038, rate_limit_hits): each
// limited action records a hit keyed by a hash of the caller's IP, and a
// caller over the limit for the window is refused. Without the table (038 not
// applied) every check passes, so a missing migration never blocks anyone.

import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The caller's IP as an HMAC, so the table never holds IP addresses. */
export function callerKey(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'thrive').update(ip).digest('hex').slice(0, 32);
}

/** How many hits this caller has in the bucket within the window. */
export async function recentHits(db: SupabaseClient, bucket: string, key: string, windowMs: number): Promise<number> {
  const { count, error } = await db
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('client_key', key)
    .gte('created_at', new Date(Date.now() - windowMs).toISOString());
  return error ? 0 : count ?? 0;
}

export async function recordHit(db: SupabaseClient, bucket: string, key: string): Promise<void> {
  await db.from('rate_limit_hits').insert({ bucket, client_key: key });
  // Keep the table small: nothing older than a day counts toward any limit.
  if (Math.random() < 0.1) {
    await db.from('rate_limit_hits').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());
  }
}

/** Records this request and says whether it is still within `max` per window. */
export async function allow(db: SupabaseClient, req: Request, bucket: string, max: number, windowMs: number): Promise<boolean> {
  const key = callerKey(req);
  if ((await recentHits(db, bucket, key, windowMs)) >= max) return false;
  await recordHit(db, bucket, key);
  return true;
}
