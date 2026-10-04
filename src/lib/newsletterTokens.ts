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

// ------------------------------------------------------------- replies
//
// Every outgoing email's Reply-To is reply-<contact id>-<signature>@ the
// inbound domain, so a reply identifies its contact even when it comes
// from a different address. Lowercase hex only (mail servers may change
// case) and short enough for the 64-character local-part limit.

function replySignature(hex: string) {
  return createHmac('sha256', key()).update(`reply:${hex}`).digest('hex').slice(0, 16);
}

/** The Reply-To for a contact's email, or the fallback when inbound mail isn't set up. */
export function replyAddress(contactId: string, fallback: string | undefined): string | undefined {
  const domain = process.env.RESEND_INBOUND_DOMAIN?.trim().toLowerCase();
  if (!domain) return fallback;
  const hex = contactId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return fallback;
  return `reply-${hex}-${replySignature(hex)}@${domain}`;
}

/** The contact id in a reply address, if the address is one of ours and genuine. */
export function contactFromReplyAddress(address: string): string | null {
  const m = /^reply-([0-9a-f]{32})-([0-9a-f]{16})@/i.exec(address.trim().replace(/^.*</, '').replace(/>$/, ''));
  if (!m) return null;
  const hex = m[1].toLowerCase();
  const expected = Buffer.from(replySignature(hex));
  const given = Buffer.from(m[2].toLowerCase());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
