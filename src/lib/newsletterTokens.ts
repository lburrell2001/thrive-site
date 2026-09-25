// Signed links for newsletter confirm and unsubscribe.
//
// A token is "<contact id>.<signature>", where the signature is an HMAC of
// the purpose and id. Nothing is stored, a confirm link cannot be used to
// unsubscribe (or the reverse), and nobody can forge one for another
// contact without the server key.

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TokenPurpose = 'confirm' | 'unsubscribe';

function key() {
  const k = process.env.NEWSLETTER_SECRET || process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('No key available to sign newsletter links');
  return k;
}

function signature(contactId: string, purpose: TokenPurpose) {
  return createHmac('sha256', key()).update(`newsletter:${purpose}:${contactId}`).digest('base64url').slice(0, 32);
}

export function signToken(contactId: string, purpose: TokenPurpose) {
  return `${contactId}.${signature(contactId, purpose)}`;
}

/** The contact id, if the token is genuine and for this purpose. */
export function verifyToken(token: string, purpose: TokenPurpose): string | null {
  const [id, sig] = (token ?? '').split('.');
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = Buffer.from(signature(id, purpose));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
