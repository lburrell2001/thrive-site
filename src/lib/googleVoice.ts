// Google Voice has no API, but it emails its account a copy of each text,
// voicemail (with a transcript) and missed call. Lauren forwards those from
// Gmail to her Outlook inbox, and the Outlook sync hands each one here.
// Pure, so it can be tested on sample emails.
//
// Calls she makes, texts she sends and calls she answers are never emailed
// by Google, so they can't be picked up; she logs those by hand.

import { normalizePhone } from './phone';

export type VoiceKind = 'text' | 'voicemail' | 'missed_call';

export type VoiceAlert = {
  kind: VoiceKind;
  /** Every phone number in the alert, E.164, most likely first. */
  phones: string[];
  /** The name Google showed instead of a number, for someone in her Google contacts. */
  name: string | null;
  /** The text message or the voicemail transcript. */
  text: string;
};

const VOICE_SENDER = /(@txt\.voice\.google\.com|voice-noreply@google\.com)\s*>?\s*$/i;

const SUBJECT = /(?:^|\b)(?:new\s+)?(text message|group message|voicemail|missed call)\s+from\s+(.+?)(?:\s+at\s+\d{1,2}:\d{2}\s*[AP]M.*)?$/i;

// Where Google's footer starts; everything after is boilerplate.
const FOOTER = /^\s*(YOUR ACCOUNT|HELP CENTER|HELP FORUM|To respond to this text message|play message|Google LLC|This email was sent to you because|You received this|<https:\/\/voice\.google\.com)/i;

const PHONE_IN_TEXT = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

export function isVoiceAlert(from: string): boolean {
  return VOICE_SENDER.test(from.trim());
}

/** The body without Google's header lines, links and footer. */
function cleanBody(body: string): string {
  const out: string[] = [];
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    if (FOOTER.test(raw)) break;
    const line = raw.replace(/<https?:\/\/[^>]+>/g, '').trim();
    // "Voicemail from: (214) 555-0123 at 3:12 PM" repeats the subject.
    if (/^(voicemail|missed call|text message)\s+from\b/i.test(line)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function phonesIn(...texts: string[]): string[] {
  const found: string[] = [];
  for (const t of texts) {
    for (const m of t.match(PHONE_IN_TEXT) ?? []) {
      const p = normalizePhone(m);
      if (p && !found.includes(p)) found.push(p);
    }
  }
  return found;
}

/** Text messages come from <their number>.<your number>.<id>@txt.voice.google.com. */
function phonesInAddress(from: string): string[] {
  const local = from.match(/<?([^<\s@]+)@txt\.voice\.google\.com/i)?.[1] ?? '';
  return local.split('.').map((part) => normalizePhone(part)).filter((p): p is string => Boolean(p));
}

/**
 * What a forwarded Google Voice email says, or null if it isn't one.
 * `ownNumber` (Lauren's Voice number) is dropped from the numbers found.
 */
export function parseVoiceAlert(email: { from: string; subject: string; body: string }, ownNumber?: string | null): VoiceAlert | null {
  if (!isVoiceAlert(email.from)) return null;
  const subject = email.subject.replace(/^\s*((fwd?|fw):\s*)+/i, '').trim();
  const m = subject.match(SUBJECT);
  if (!m) return null;

  const kind: VoiceKind = /voicemail/i.test(m[1]) ? 'voicemail' : /missed/i.test(m[1]) ? 'missed_call' : 'text';
  const who = m[2].trim();
  const own = normalizePhone(ownNumber ?? '');

  const phones = [...phonesIn(who), ...phonesInAddress(email.from), ...phonesIn(email.body)]
    .filter((p, i, all) => p !== own && all.indexOf(p) === i);
  const name = phonesIn(who).length ? null : who.replace(/^["']|["']$/g, '') || null;

  return { kind, phones, name, text: cleanBody(email.body).slice(0, 4000) };
}

/**
 * Google Voice on the web, opened on a conversation with this number: the
 * CRM's Text button. Google doesn't document this link, so the Text form also
 * copies the message and shows the number to paste if it lands elsewhere.
 */
export function googleVoiceUrl(phone: string | null | undefined): string {
  const e164 = normalizePhone(phone);
  return e164
    ? `https://voice.google.com/u/0/messages?itemId=t.${encodeURIComponent(e164)}`
    : 'https://voice.google.com/u/0/messages';
}
