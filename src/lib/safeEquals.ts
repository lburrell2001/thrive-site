// Constant-time string comparison for secrets (cron secret, document tokens),
// so response timing can't reveal how much of a guess was right.

import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

export function safeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  // Hashing first makes the buffers equal length, so length isn't leaked either.
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && safeEquals(req.headers.get('Authorization'), `Bearer ${secret}`);
}
