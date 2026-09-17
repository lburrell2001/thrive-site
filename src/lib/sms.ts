// Text messages via Twilio.
//
// Called over Twilio's REST API with fetch rather than the SDK — one POST is
// all this needs, and it keeps a large dependency out of every route that
// can notify someone.
//
// Like the emails, texts are best-effort: callers record the thing that
// happened first, and a failed text is logged or reported, never thrown.

import 'server-only';
import { normalizePhone } from '@/lib/phone';

export type SmsResult =
  | { ok: true; sid: string; to: string }
  | { ok: false; error: string; to: string | null; optedOut?: boolean };

/** Twilio error 21610: the recipient replied STOP to this sender. */
const OPTED_OUT = 21610;

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

export async function sendSms(toInput: string, body: string): Promise<SmsResult> {
  const to = normalizePhone(toInput);
  if (!to) return { ok: false, error: `"${toInput}" is not a valid phone number`, to: null };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !(service || from)) {
    return { ok: false, error: 'Text messages are not set up (Twilio env vars missing)', to };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service handles sender selection and STOP/HELP replies; a
  // bare number works for testing.
  if (service) form.set('MessagingServiceSid', service);
  else form.set('From', from!);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok || !json.sid) {
      return {
        ok: false,
        error: json.message ?? `Twilio returned ${res.status}`,
        to,
        optedOut: json.code === OPTED_OUT,
      };
    }
    return { ok: true, sid: json.sid, to };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Text failed to send', to };
  }
}

/**
 * Text Lauren. Her own number, so no opt-in applies — it is simply off until
 * CONTACT_NOTIFY_PHONE is set.
 */
export async function textAgency(body: string): Promise<void> {
  const to = process.env.CONTACT_NOTIFY_PHONE;
  if (!to || !smsConfigured()) return;
  const result = await sendSms(to, body);
  if (!result.ok) console.error('Agency text failed:', result.error);
}
