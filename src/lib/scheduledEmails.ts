// Sends whatever is due: audience emails (newsletters) and one-to-one drafts
// with a scheduled_at in the past. Vercel Cron calls this every five minutes
// (/api/cron/scheduled-emails). Each send claims its row first, so an
// overlapping run, or Lauren clicking Send at the same moment, can't send
// twice. A failure leaves the email marked failed with the reason, and
// Lauren gets an email saying so — nobody is watching when the cron runs.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { BRAND, brandEmail, button, esc, paragraph } from '@/lib/emailLayout';
import { sendNewsletter } from '@/lib/newsletter';
import { sendProspectDraft } from '@/lib/prospects';

interface Failure { what: string; error: string; href: string }

export async function sendDueEmails(db: SupabaseClient, site: string) {
  const now = new Date().toISOString();
  const [{ data: newsletters }, { data: drafts }] = await Promise.all([
    db.from('newsletters').select('id, subject').eq('status', 'scheduled').lte('scheduled_at', now).order('scheduled_at'),
    db.from('prospect_drafts').select('id, contact_id, subject').eq('status', 'scheduled').lte('scheduled_at', now).order('scheduled_at'),
  ]);

  let sent = 0;
  const failures: Failure[] = [];

  for (const n of newsletters ?? []) {
    try {
      await sendNewsletter(db, n.id, site, ['scheduled']);
      sent += 1;
    } catch (e) {
      failures.push({ what: `“${n.subject || 'Untitled email'}”`, error: e instanceof Error ? e.message : 'Could not send', href: `${site}/admin/crm/emails/${n.id}` });
    }
  }
  for (const d of drafts ?? []) {
    try {
      if (await sendProspectDraft(db, d.id, site)) sent += 1;
    } catch (e) {
      failures.push({ what: `“${d.subject || 'Untitled email'}” to one contact`, error: e instanceof Error ? e.message : 'Could not send', href: `${site}/admin/crm?contact=${d.contact_id}` });
    }
  }

  if (failures.length) await tellLauren(failures, site).catch(() => {});
  return { sent, failed: failures.length };
}

async function tellLauren(failures: Failure[], site: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  const to = process.env.CONTACT_NOTIFY_TO;
  if (!key || !from || !to) return;
  const subject = failures.length === 1 ? 'A scheduled email didn’t send' : `${failures.length} scheduled emails didn’t send`;
  const html = brandEmail({
    title: subject,
    preheader: failures[0].error,
    eyebrow: 'Scheduled email',
    accent: 'orange',
    heading: subject,
    body: [
      ...failures.map((f) => paragraph(`<strong>${esc(f.what)}</strong><br>${esc(f.error)} — <a href="${esc(f.href)}" style="color:${BRAND.magenta};">open it</a>`, { html: true })),
      paragraph('Fix it, then schedule it again or send it now.'),
      button(`${site}/admin/crm/emails`, 'Open Emails'),
    ].join('\n'),
  });
  const text = `${subject}\n\n${failures.map((f) => `${f.what}: ${f.error}\n${f.href}`).join('\n\n')}`;
  await new Resend(key).emails.send({ from, to, subject, html, text });
}
