// Reads new mail from the connected Outlook mailboxes — Lauren's own and any
// she has Full Access to, such as hello@ (Vercel Cron, every 5 minutes, and
// "Sync now" in Emails → Settings). Only mail involving a CRM contact is kept,
// plus forwarded Google Voice alerts:
//
//   Inbox, from a contact      → email_replies (logReply: Today, timeline, leads, tasks)
//   Inbox, Google Voice alert  → voice_events + a 'text' or 'call' activity on the contact
//   Sent Items, to a contact   → outlook_sent, unless the CRM sent it (already logged);
//                                answering closes their open "Reply to …" task
//
// Each mailbox's folders are read from where the last sync stopped (minus a
// little overlap); unique keys make re-reading harmless, including the same
// email arriving in both mailboxes.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backfillFrom, graph, loadConnection, mailboxesOf, mailboxPath, outlookConfigured, OutlookError, type Folder } from './outlook';
import { addTaskOnce, logReply, openLeadForProspect, stripQuoted } from './inboundEmail';
import { parseVoiceAlert, type VoiceAlert } from './googleVoice';
import { formatPhone, normalizePhone } from './phone';

type Address = { emailAddress?: { address?: string; name?: string } };
type GraphMessage = {
  id: string;
  internetMessageId?: string;
  subject?: string;
  from?: Address;
  toRecipients?: Address[];
  ccRecipients?: Address[];
  receivedDateTime: string;
  sentDateTime: string;
  bodyPreview?: string;
  body?: { content?: string };
  webLink?: string;
};
type Page = { value: GraphMessage[]; '@odata.nextLink'?: string };

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; prospect_status: string | null };

const SELECT = 'id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,body,webLink';
const OVERLAP_MS = 5 * 60_000;
const MAX_PAGES = 8;
// CRM sends show up in Sent Items too; within this window they're the same email.
const SAME_SEND_MS = 15 * 60_000;

const addr = (a?: Address) => (a?.emailAddress?.address ?? '').trim().toLowerCase();

async function readFolder(db: SupabaseClient, base: string, folder: Folder, since: string): Promise<GraphMessage[]> {
  // Sent Items carry receivedDateTime too (≈ when it was sent), and it's the
  // field Graph filters and sorts on most reliably.
  const field = 'receivedDateTime';
  const from = new Date(Date.parse(since) - OVERLAP_MS).toISOString();
  // Built by hand so the $ in the OData options stays literal.
  const q = [
    `$filter=${encodeURIComponent(`${field} ge ${from}`)}`,
    `$orderby=${encodeURIComponent(`${field} asc`)}`,
    '$top=50',
    `$select=${SELECT}`,
  ].join('&');
  let url: string | undefined = `${base}/mailFolders/${folder}/messages?${q}`;
  const out: GraphMessage[] = [];
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const page: Page = await graph<Page>(db, url, { prefer: 'outlook.body-content-type="text"' });
    out.push(...page.value);
    url = page['@odata.nextLink'];
  }
  return out;
}

async function contactsByEmail(db: SupabaseClient, emails: string[]): Promise<Map<string, Contact>> {
  const unique = [...new Set(emails.filter(Boolean))];
  const map = new Map<string, Contact>();
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await db.from('crm_contacts').select('id, name, email, phone, prospect_status').in('email', unique.slice(i, i + 100));
    for (const c of (data ?? []) as Contact[]) if (c.email && !map.has(c.email)) map.set(c.email, c);
  }
  return map;
}

/** Everyone with a phone number, keyed by E.164, for matching Google Voice alerts. */
async function contactsByPhone(db: SupabaseClient) {
  const { data } = await db.from('crm_contacts').select('id, name, email, phone, prospect_status').not('phone', 'is', null).limit(5000);
  const byPhone = new Map<string, Contact>();
  const byName = new Map<string, Contact>();
  for (const c of (data ?? []) as Contact[]) {
    const p = normalizePhone(c.phone);
    if (p && !byPhone.has(p)) byPhone.set(p, c);
    if (c.name) byName.set(c.name.trim().toLowerCase(), c);
  }
  return { byPhone, byName };
}

type PhoneBook = Awaited<ReturnType<typeof contactsByPhone>>;

function matchVoice(book: PhoneBook, phones: string[], name: string | null): Contact | null {
  for (const p of phones) { const c = book.byPhone.get(p); if (c) return c; }
  return name ? book.byName.get(name.trim().toLowerCase()) ?? null : null;
}

const VOICE_TITLE: Record<VoiceAlert['kind'], string> = { text: 'Texted you', voicemail: 'Left you a voicemail', missed_call: 'Called you (missed)' };

/** The activity on a contact for one alert. Calls use the Calls page's metadata. */
async function voiceActivity(db: SupabaseClient, contact: Contact, ev: { kind: VoiceAlert['kind']; phone: string | null; body: string; occurred_at: string }) {
  const metadata = ev.kind === 'text'
    ? { direction: 'received', source: 'google_voice', phone: ev.phone }
    : { direction: 'inbound', outcome: ev.kind === 'voicemail' ? 'voicemail' : 'no_answer', minutes: null, source: 'google_voice', phone: ev.phone };
  const { data } = await db.from('crm_activities').insert({
    contact_id: contact.id,
    kind: ev.kind === 'text' ? 'text' : 'call',
    body: ev.body,
    metadata,
    created_at: ev.occurred_at,
  }).select('id').single();
  return data?.id ?? null;
}

/** True when the alert is new. */
async function handleVoice(db: SupabaseClient, book: PhoneBook, m: GraphMessage, alert: VoiceAlert, fresh: boolean): Promise<boolean> {
  const contact = matchVoice(book, alert.phones, alert.name);
  const phone = alert.phones[0] ?? null;
  const { data: ev, error } = await db.from('voice_events').insert({
    source_id: m.internetMessageId ?? m.id,
    kind: alert.kind,
    phone,
    caller_name: alert.name,
    body: alert.text,
    occurred_at: m.receivedDateTime,
    contact_id: contact?.id ?? null,
  }).select('id').single();
  if (error) return false; // seen before (unique source_id)
  if (!contact) return true;

  const activityId = await voiceActivity(db, contact, { kind: alert.kind, phone, body: alert.text, occurred_at: m.receivedDateTime });
  if (activityId) await db.from('voice_events').update({ activity_id: activityId }).eq('id', ev.id);
  if (fresh) {
    const who = contact.name || formatPhone(phone) || 'them';
    await openLeadForProspect(db, contact, `${VOICE_TITLE[alert.kind]} (Google Voice)`, 'phone');
    await addTaskOnce(db, contact.id, alert.kind === 'text' ? `Text ${who} back` : `Call ${who} back`);
  }
  return true;
}

/** Alerts from numbers that weren't in the CRM yet: attach them once a contact has the number. */
async function rematchVoice(db: SupabaseClient, book: PhoneBook) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await db.from('voice_events').select('id, kind, phone, caller_name, body, occurred_at').is('contact_id', null).gte('occurred_at', since).limit(200);
  for (const ev of data ?? []) {
    const contact = matchVoice(book, ev.phone ? [ev.phone] : [], ev.caller_name);
    if (!contact) continue;
    const activityId = await voiceActivity(db, contact, ev);
    await db.from('voice_events').update({ contact_id: contact.id, activity_id: activityId }).eq('id', ev.id);
  }
}

async function sentByCrm(db: SupabaseClient, contactId: string, to: string, subject: string, at: string): Promise<boolean> {
  const from = new Date(Date.parse(at) - SAME_SEND_MS).toISOString();
  const until = new Date(Date.parse(at) + SAME_SEND_MS).toISOString();
  const [a, b] = await Promise.all([
    db.from('prospect_emails').select('id').eq('contact_id', contactId).eq('subject', subject).gte('sent_at', from).lte('sent_at', until).limit(1),
    db.from('client_reminders').select('id').eq('email_to', to).eq('subject', subject).gte('created_at', from).lte('created_at', until).limit(1),
  ]);
  return Boolean(a.data?.length || b.data?.length);
}

export type SyncResult = { replies: number; sent: number; voice: number };

export async function syncOutlook(db: SupabaseClient): Promise<SyncResult | { skipped: string }> {
  if (!outlookConfigured()) return { skipped: 'Outlook is not configured' };
  const conn = await loadConnection(db);
  if (!conn) return { skipped: 'Outlook is not connected' };

  const result: SyncResult = { replies: 0, sent: 0, voice: 0 };
  const mailboxes = mailboxesOf(conn);
  // Mail between Lauren's own mailboxes (hello@ ↔ lauren@) is never a contact's.
  const own = new Set(mailboxes);
  // Mail from before the connection is history: logged, but no tasks or new leads.
  const freshAfter = Date.parse(conn.connected_at) - 60_000;
  const cursors = structuredClone(conn.cursors ?? {});
  const errors: string[] = [];

  for (const mailbox of mailboxes) {
    try {
      const base = mailboxPath(conn, mailbox);
      const since = cursors[mailbox] ?? {};
      const [inbox, sent] = await Promise.all([
        readFolder(db, base, 'inbox', since.inbox ?? backfillFrom()),
        readFolder(db, base, 'sentitems', since.sentitems ?? backfillFrom()),
      ]);
      await handleInbox(db, inbox, own, freshAfter, result);
      await handleSent(db, sent, result);

      const latest = (list: GraphMessage[], prev: string | undefined) =>
        list.reduce((max, m) => (Date.parse(m.receivedDateTime) > Date.parse(max) ? m.receivedDateTime : max), prev ?? backfillFrom());
      cursors[mailbox] = { inbox: latest(inbox, since.inbox), sentitems: latest(sent, since.sentitems) };
    } catch (e) {
      // A token problem stops everything; one mailbox losing access doesn't.
      if (e instanceof OutlookError && e.message.startsWith('Reconnect')) throw e;
      errors.push(`${mailbox}: ${e instanceof Error ? e.message : 'could not be read'}`);
    }
  }

  await rematchVoice(db, await contactsByPhone(db));
  await db.from('mail_connection').update({
    cursors,
    last_sync_at: new Date().toISOString(),
    last_error: errors.length ? errors.join(' · ').slice(0, 1000) : null,
  }).eq('id', 1);
  return result;
}

async function handleInbox(db: SupabaseClient, inbox: GraphMessage[], own: Set<string>, freshAfter: number, result: SyncResult) {
  const voice: { m: GraphMessage; alert: VoiceAlert }[] = [];
  const mail: GraphMessage[] = [];
  for (const m of inbox) {
    const from = m.from?.emailAddress;
    const alert = parseVoiceAlert(
      { from: `${from?.name ?? ''} <${from?.address ?? ''}>`, subject: m.subject ?? '', body: m.body?.content ?? '' },
      process.env.GOOGLE_VOICE_NUMBER,
    );
    if (alert) voice.push({ m, alert });
    else if (addr(m.from) && !own.has(addr(m.from))) mail.push(m);
  }

  const byEmail = await contactsByEmail(db, mail.map((m) => addr(m.from)));
  for (const m of mail) {
    const contact = byEmail.get(addr(m.from));
    if (!contact) continue;
    const logged = await logReply(db, {
      sourceId: `outlook:${m.internetMessageId ?? m.id}`,
      contact,
      fromEmail: addr(m.from),
      fromName: m.from?.emailAddress?.name ?? null,
      subject: m.subject ?? '',
      text: stripQuoted(m.body?.content ?? m.bodyPreview ?? ''),
      receivedAt: m.receivedDateTime,
      // It's already in her inbox.
      forwarded: true,
      act: Date.parse(m.receivedDateTime) > freshAfter,
    });
    if ('id' in logged) result.replies++;
  }

  if (!voice.length) return;
  const book = await contactsByPhone(db);
  for (const { m, alert } of voice) {
    if (await handleVoice(db, book, m, alert, Date.parse(m.receivedDateTime) > freshAfter)) result.voice++;
  }
}

async function handleSent(db: SupabaseClient, sent: GraphMessage[], result: SyncResult) {
  const recipients = (m: GraphMessage) => [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].map(addr).filter(Boolean);
  const sentTo = await contactsByEmail(db, sent.flatMap(recipients));
  for (const m of sent) {
    for (const to of new Set(recipients(m))) {
      const contact = sentTo.get(to);
      if (!contact) continue;
      if (await sentByCrm(db, contact.id, to, m.subject ?? '', m.sentDateTime)) continue;
      const { error } = await db.from('outlook_sent').insert({
        internet_message_id: m.internetMessageId ?? m.id,
        contact_id: contact.id,
        to_email: to,
        subject: m.subject ?? '',
        preview: (m.bodyPreview ?? '').slice(0, 600),
        web_link: m.webLink ?? null,
        sent_at: m.sentDateTime,
      });
      if (error) continue; // already recorded
      result.sent++;
      // She answered them, so the "Reply to …" task from their email is done.
      await db.from('crm_tasks').update({ completed_at: m.sentDateTime })
        .eq('contact_id', contact.id).like('title', 'Reply to %').is('completed_at', null).lte('created_at', m.sentDateTime);
    }
  }
}
