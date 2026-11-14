// When a client's estimate or proposal link is broken (the ?t= key cut off by
// their mail app, or a partial copy-paste), the page offers "Send me a fresh
// link" instead of a dead end. They type the email it was sent to; every open
// estimate and proposal sent to that address is emailed again with its full
// link, and Lauren is told. The answer is always the same, so the form can't
// be used to learn who has an estimate. Used by POST /api/link-help.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deliver, crmContact, type Contact } from './clientNotify';
import { tellLauren } from './agencyNotify';
import { recentHits, recordHit } from './rateLimit';
import { SITE_URL } from './seo';

type Doc = { kind: 'estimate' | 'proposal'; label: string; url: string; firstName: string | null };

/** ilike with the email's own `_` / `%` taken literally. */
const exact = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);
const first = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || null;
const SINCE_DAYS = 180;

async function docsFor(db: SupabaseClient, email: string): Promise<Doc[]> {
  const since = new Date(Date.now() - SINCE_DAYS * 86_400_000).toISOString();
  const docs: Doc[] = [];

  const { data: ests } = await db.from('estimates')
    .select('id, estimate_number, title, access_token, crm_contact_id, status, updated_at')
    .ilike('sent_to', exact(email)).neq('status', 'draft').gte('updated_at', since)
    .order('updated_at', { ascending: false }).limit(5);
  for (const e of ests ?? []) {
    if (!e.access_token) continue;
    const who = e.crm_contact_id ? await crmContact(db, e.crm_contact_id).catch(() => null) : null;
    docs.push({
      kind: 'estimate',
      label: `Estimate ${e.estimate_number}${e.title ? ` — ${e.title}` : ''}`,
      url: `${SITE_URL}/e/${e.id}?t=${e.access_token}`,
      firstName: first(who?.name),
    });
  }

  const { data: recips } = await db.from('proposal_clients').select('id, name').ilike('email', exact(email));
  if (recips?.length) {
    const names = new Map(recips.map((r) => [r.id as string, r.name as string | null]));
    const { data: props } = await db.from('proposals')
      .select('slug, title, access_token, client_id, updated_at')
      .in('client_id', [...names.keys()]).neq('status', 'draft').gte('updated_at', since)
      .order('updated_at', { ascending: false }).limit(5);
    for (const p of props ?? []) {
      if (!p.access_token) continue;
      docs.push({
        kind: 'proposal',
        label: `Proposal — ${p.title}`,
        url: `${SITE_URL}/p/${p.slug}?t=${p.access_token}`,
        firstName: first(names.get(p.client_id)),
      });
    }
  }
  return docs;
}

/** Emails each matching estimate/proposal its full link, and tells Lauren. */
export async function sendFreshLinks(db: SupabaseClient, emailIn: string, brokenPath: string | null): Promise<void> {
  const email = emailIn.trim().toLowerCase();
  const docs = await docsFor(db, email);

  for (const d of docs) {
    const contact: Contact = {
      portalClientId: null, proposalClientId: null, name: d.firstName ?? '', firstName: d.firstName ?? 'there',
      email, phone: null, smsOptIn: false, smsSource: null,
    };
    await deliver(db, contact, {
      subject: `Your fresh link: ${d.label}`,
      eyebrow: d.kind === 'estimate' ? 'Your estimate' : 'Your proposal',
      headline: `Here’s a fresh link to your ${d.kind}. Tap the button below to open it — if you copy the link instead, be sure to copy all of it.`,
      detail: d.label,
      ctaUrl: d.url,
      ctaLabel: d.kind === 'estimate' ? 'View & accept your estimate' : 'Review & sign your proposal',
      sms: null,
    }, { email: true, sms: false }, { fromInbox: true }).catch((e) => console.error('[linkRecovery] send', e));
  }

  const where = brokenPath ? `\n\nThe broken link they opened: ${SITE_URL}${brokenPath}` : '';
  if (docs.length) {
    const list = docs.map((d) => d.label).join(', ');
    await tellLauren(
      `Fresh link sent to ${email}`,
      `${email} opened a broken link and asked for a fresh one. I emailed them the full link to: ${list}.${where}`,
      `Heads up: ${email} had a broken link and got a fresh one for ${list}.`,
    );
  } else {
    await tellLauren(
      `Fresh link asked for — nothing found for ${email}`,
      `Someone opened a broken estimate/proposal link and asked for a fresh one at ${email}, but nothing has been sent to that address in the last ${SINCE_DAYS} days (maybe a different email?). You may want to reach out.${where}`,
    );
  }
}

/**
 * A real estimate/proposal was opened with a missing or wrong key: tell
 * Lauren (at most every 6 hours per document) so she can check on them.
 */
export async function reportBrokenLink(db: SupabaseClient, doc: { key: string; label: string; client: string | null; path: string; clientUrl: string }): Promise<void> {
  try {
    const bucket = 'broken_link';
    if ((await recentHits(db, bucket, doc.key, 6 * 3_600_000)) > 0) return;
    await recordHit(db, bucket, doc.key);
    await tellLauren(
      `Broken link opened: ${doc.label}`,
      `Someone${doc.client ? ` (${doc.client})` : ''} opened ${doc.label} with an incomplete link — the key at the end was missing or cut off. The page offered them a fresh link by email; you may want to text them the full link.\n\nThe full link to send them:\n${doc.clientUrl}\n\nIn admin: ${SITE_URL}${doc.path}`,
      `Heads up: ${doc.label}${doc.client ? ` (${doc.client})` : ''} was opened with an incomplete link. They were offered a fresh one. Full link to send them: ${doc.clientUrl}`,
    );
  } catch (e) {
    console.error('[linkRecovery] report', e);
  }
}
