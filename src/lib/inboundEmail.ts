// Replies to Thrive emails, received through Resend.
//
// Every email Lauren sends from the site has a Reply-To of
// reply-<contact>-<signature>@RESEND_INBOUND_DOMAIN (newsletterTokens.ts).
// Resend receives the reply and calls POST /api/email/inbound with
// `email.received`; this file takes it from there:
//
//   1. Fetch the full message (the webhook carries only the envelope).
//   2. Find the contact: from the signed reply address, else the sender's
//      email.
//   3. Store it once in email_replies (Resend's id is unique, so a
//      redelivered webhook does nothing).
//   4. A prospect's reply opens a deal at New lead — which converts them
//      (database trigger) — and adds a "Reply to …" task for today.
//   5. Forward it, attachments included, to Lauren's inbox with Reply-To
//      set to the sender, so answering it from Gmail goes straight back.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { esc } from '@/lib/emailText';
import { contactFromReplyAddress } from '@/lib/newsletterTokens';
import { SITE_URL } from '@/lib/seo';

export class InboundError extends Error {}

export interface ReceivedEvent {
  type: string;
  data: { email_id: string; from: string; to: string[]; subject?: string };
}

/** "Maya Lin <maya@x.com>" → { email, name }. */
function parseAddress(raw: string): { email: string; name: string | null } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  return m ? { email: m[2].trim().toLowerCase(), name: m[1].trim() || null } : { email: raw.trim().toLowerCase(), name: null };
}

/**
 * The new part of a reply: everything above the quoted original. Mail apps
 * mark the quote differently; these cover Gmail, Apple Mail and Outlook.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cut = lines.findIndex((l, i) =>
    /^On .+(wrote|écrit):\s*$/i.test(l.trim())
    || (/^On .+/i.test(l.trim()) && /wrote:\s*$/i.test(lines[i + 1]?.trim() ?? ''))
    || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim())
    || /^From:\s.+/i.test(l.trim()) && /^(Sent|Date):\s/i.test(lines[i + 1]?.trim() ?? '')
    || /^_{10,}$/.test(l.trim()),
  );
  const kept = (cut >= 0 ? lines.slice(0, cut) : lines).filter((l) => !/^>/.test(l.trim()));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|head|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const cleanSubject = (s: string) => s.replace(/^\s*((re|fwd?|aw):\s*)+/i, '').trim();

export async function handleInbound(db: SupabaseClient, event: ReceivedEvent) {
  if (event.type !== 'email.received') return { skipped: 'not a received email' };
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new InboundError('RESEND_API_KEY is not set');
  const resend = new Resend(key);

  const { data: already } = await db.from('email_replies').select('id').eq('resend_email_id', event.data.email_id).maybeSingle();
  if (already) return { skipped: 'already handled' };

  const { data: full, error } = await resend.emails.receiving.get(event.data.email_id);
  if (error || !full) throw new InboundError(error?.message ?? 'Could not fetch the received email');

  const sender = parseAddress(full.from);
  const ourFrom = parseAddress(process.env.CONTACT_NOTIFY_FROM ?? '').email;
  // Never act on mail from ourselves (a bounce loop or a forwarded copy).
  if (sender.email && sender.email === ourFrom) return { skipped: 'from our own address' };

  // Who it's from: the signed reply address first, then the sender.
  let contactId: string | null = null;
  for (const to of [...full.to, ...(event.data.to ?? [])]) {
    contactId = contactFromReplyAddress(to);
    if (contactId) break;
  }
  const byId = contactId
    ? (await db.from('crm_contacts').select('id, name, email, prospect_status').eq('id', contactId).maybeSingle()).data
    : null;
  const contact = byId ?? (sender.email
    ? (await db.from('crm_contacts').select('id, name, email, prospect_status').ilike('email', sender.email).order('created_at').limit(1).maybeSingle()).data
    : null);

  const body = stripQuoted(full.text ?? (full.html ? htmlToText(full.html) : ''));
  const subject = full.subject ?? '';

  const { data: reply, error: insertError } = await db.from('email_replies').insert({
    resend_email_id: full.id,
    contact_id: contact?.id ?? null,
    from_email: sender.email,
    from_name: sender.name,
    subject,
    text: body.slice(0, 20_000),
  }).select('id').single();
  // A concurrent delivery of the same webhook got there first.
  if (insertError) return { skipped: insertError.code === '23505' ? 'already handled' : insertError.message };

  if (contact) {
    const now = new Date().toISOString();
    await db.from('crm_contacts').update({ replied_at: now }).eq('id', contact.id);

    // A prospect writing back becomes a lead, unless something already opened a deal.
    if (contact.prospect_status === 'prospect') {
      const { data: open } = await db.from('crm_deals').select('id').eq('contact_id', contact.id).in('stage', ['lead', 'contacted', 'proposal']).limit(1);
      if (!open?.length) {
        await db.from('crm_deals').insert({
          contact_id: contact.id,
          title: cleanSubject(subject) ? `Replied: ${cleanSubject(subject)}`.slice(0, 160) : 'Replied to an email',
          stage: 'lead',
          source: 'email reply',
        });
      }
    }
    await db.from('crm_tasks').insert({
      contact_id: contact.id,
      title: `Reply to ${contact.name || sender.name || sender.email}`,
      due_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }),
    });
  }

  // Forward to Lauren. Reply-To is the sender, so answering goes to them.
  const lauren = process.env.CONTACT_NOTIFY_TO;
  const from = process.env.CONTACT_NOTIFY_FROM;
  let forwardError: string | null = null;
  if (lauren && from) {
    const who = sender.name ? `${sender.name} <${sender.email}>` : sender.email;
    const crmLink = contact ? `${SITE_URL}/admin/crm?contact=${contact.id}` : null;
    const banner = `<div style="font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#444;background:#f5f4f1;border-radius:8px;padding:10px 14px;margin:0 0 18px;">
Reply from <strong>${esc(who)}</strong>${contact ? '' : ' — not in the CRM yet'}.
${contact?.prospect_status === 'prospect' ? ' They were a prospect; they’re now a <strong>New lead</strong>.' : ''}
${crmLink ? ` <a href="${esc(crmLink)}" style="color:#e50586;">Open in the CRM</a>` : ''}
<br>Hit reply to answer them directly.</div>`;
    // Attachments go along too, fetched by Resend from its short-lived download links.
    const files = full.attachments?.length
      ? ((await resend.emails.receiving.attachments.list({ emailId: full.id })).data?.data ?? [])
      : [];
    const { error: fwd } = await resend.emails.send({
      from,
      to: lauren,
      replyTo: full.from,
      subject: subject || '(no subject)',
      html: banner + (full.html ?? `<pre style="font:14px/1.6 -apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;">${esc(full.text ?? '')}</pre>`),
      text: `Reply from ${who}${crmLink ? `\n${crmLink}` : ''}\n\n${full.text ?? ''}`,
      ...(files.length ? { attachments: files.map((f) => ({ filename: f.filename, path: f.download_url, contentType: f.content_type, ...(f.content_id ? { contentId: f.content_id } : {}) })) } : {}),
    });
    forwardError = fwd?.message ?? null;
  } else {
    forwardError = 'CONTACT_NOTIFY_TO / CONTACT_NOTIFY_FROM not set';
  }
  await db.from('email_replies').update({ forwarded: !forwardError, forward_error: forwardError }).eq('id', reply.id);

  return { contact: contact?.id ?? null, forwarded: !forwardError };
}
