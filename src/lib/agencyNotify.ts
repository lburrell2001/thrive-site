// Telling Lauren something a client did (accepted, declined): an email to
// CONTACT_NOTIFY_TO and a text to CONTACT_NOTIFY_PHONE. Never throws.

import 'server-only';
import { Resend } from 'resend';
import { textAgency } from './sms';

export async function tellLauren(subject: string, text: string, sms?: string) {
  await Promise.all([
    sms ? textAgency(sms).catch((e) => console.error('[tellLauren] text', e)) : Promise.resolve(),
    (async () => {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.CONTACT_NOTIFY_FROM;
      const to = process.env.CONTACT_NOTIFY_TO;
      if (!apiKey || !from || !to) return;
      await new Resend(apiKey).emails.send({ from, to, subject, text }).catch((e) => console.error('[tellLauren] email', e));
    })(),
  ]);
}
