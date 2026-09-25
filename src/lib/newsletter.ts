// Newsletter: signing up, confirming, unsubscribing, and sending.
//
// Subscription lives on the CRM contact (crm_contacts.newsletter_status).
// Only 'subscribed' contacts are ever emailed. Footer signups are double
// opt-in: they stay 'pending' until the confirm link is clicked, so nobody
// can put someone else's address on the list.
//
// Sending goes through Resend's batch API, 100 at a time, each recipient
// with their own unsubscribe link and one-click List-Unsubscribe headers.
// Every recipient is recorded in newsletter_sends; a failed send can be
// retried and only reaches the people it missed.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { renderNewsletter } from '@/lib/newsletterEmail';
import { signToken, verifyToken } from '@/lib/newsletterTokens';

export class NewsletterError extends Error {}

export type Audience = 'subscribers' | 'clients' | 'leads' | 'tag';

export interface Newsletter {
  id: string;
  subject: string;
  preheader: string;
  body: string;
  audience: Audience;
  audience_tag: string | null;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  last_error: string | null;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const ADDRESS_KEY = 'newsletter_postal_address';
const BATCH = 100;
const CONFIRM_THROTTLE_MS = 10 * 60_000;

function resend() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (!key || !from) throw new NewsletterError('Email is not set up (RESEND_API_KEY and CONTACT_NOTIFY_FROM)');
  return { client: new Resend(key), from };
}

const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || null;

// ------------------------------------------------------------- settings

export async function postalAddress(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from('admin_config').select('value').eq('key', ADDRESS_KEY).maybeSingle();
  return data?.value?.trim() || null;
}

export async function setPostalAddress(db: SupabaseClient, address: string) {
  const value = address.trim();
  const now = new Date().toISOString();
  // admin_config predates the migrations, so don't rely on a unique key for
  // an upsert: update if the row exists, insert if not.
  const { data: existing } = await db.from('admin_config').select('key').eq('key', ADDRESS_KEY).maybeSingle();
  const { error } = existing
    ? await db.from('admin_config').update({ value, updated_at: now }).eq('key', ADDRESS_KEY)
    : await db.from('admin_config').insert({ key: ADDRESS_KEY, value, updated_at: now });
  if (error) throw new NewsletterError(error.message);
}

// --------------------------------------------------------- subscribing

/**
 * A footer signup. Creates the contact if needed and emails a confirm link.
 * Returns 'already' for someone already subscribed (without saying so to
 * the visitor, which would reveal who is on the list).
 */
export async function requestSubscription(
  db: SupabaseClient,
  input: { email: string; name?: string | null; source: string },
  site: string,
): Promise<'sent' | 'already'> {
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await db
    .from('crm_contacts')
    .select('id, name, newsletter_status, newsletter_confirm_sent_at')
    .eq('email', email)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  let contact = existing;
  if (!contact) {
    const { data: created, error } = await db
      .from('crm_contacts')
      .insert({ name: input.name?.trim() || '', email, source: 'newsletter', newsletter_status: 'pending', newsletter_source: input.source })
      .select('id, name, newsletter_status, newsletter_confirm_sent_at')
      .single();
    if (error) throw new NewsletterError(error.message);
    contact = created;
  } else if (contact.newsletter_status === 'subscribed') {
    return 'already';
  } else {
    await db.from('crm_contacts')
      .update({ newsletter_status: 'pending', newsletter_source: input.source })
      .eq('id', contact.id);
  }

  // One confirm email per ten minutes, so the form can't be used to flood
  // someone's inbox.
  const last = contact.newsletter_confirm_sent_at ? Date.parse(contact.newsletter_confirm_sent_at) : 0;
  if (Date.now() - last < CONFIRM_THROTTLE_MS) return 'sent';

  const { client, from } = resend();
  const link = `${site}/newsletter/confirm/${signToken(contact.id, 'confirm')}`;
  const name = firstName(contact.name || input.name);
  const { error } = await client.emails.send({
    from,
    to: email,
    subject: 'Confirm your subscription to Thrive Creative Studios',
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px;color:#111;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.06em;color:#e40586;">THRIVE CREATIVE STUDIOS</div>
      <p style="font-size:16px;line-height:1.6;">${name ? `Hi ${name.replace(/[<>&"]/g, '')},` : 'Hi,'}</p>
      <p style="font-size:16px;line-height:1.6;">Tap the button to confirm you'd like occasional emails from Thrive — new work, practical branding and web advice, and studio news. No spam, and you can leave any time.</p>
      <p><a href="${link}" style="display:inline-block;background:#e40586;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;">Confirm subscription</a></p>
      <p style="font-size:13px;color:#777;">If you didn't sign up, ignore this email and you won't hear from us.</p>
    </div>`,
    text: `Confirm you'd like occasional emails from Thrive Creative Studios:\n${link}\n\nIf you didn't sign up, ignore this email.`,
  });
  if (error) throw new NewsletterError(error.message);
  await db.from('crm_contacts').update({ newsletter_confirm_sent_at: new Date().toISOString() }).eq('id', contact.id);
  return 'sent';
}

export async function confirmSubscription(db: SupabaseClient, token: string): Promise<'confirmed' | 'invalid' | 'unsubscribed'> {
  const id = verifyToken(token, 'confirm');
  if (!id) return 'invalid';
  const { data } = await db.from('crm_contacts').select('newsletter_status').eq('id', id).maybeSingle();
  if (!data) return 'invalid';
  // An old confirm link can't undo a later unsubscribe.
  if (data.newsletter_status === 'unsubscribed') return 'unsubscribed';
  if (data.newsletter_status !== 'subscribed') {
    await db.from('crm_contacts').update({ newsletter_status: 'subscribed' }).eq('id', id);
    await db.from('crm_activities').insert({ contact_id: id, kind: 'note', body: 'Subscribed to the newsletter (confirmed by email).' });
  }
  return 'confirmed';
}

export async function unsubscribe(db: SupabaseClient, token: string): Promise<boolean> {
  const id = verifyToken(token, 'unsubscribe');
  if (!id) return false;
  const { data } = await db.from('crm_contacts').select('newsletter_status').eq('id', id).maybeSingle();
  if (!data) return false;
  if (data.newsletter_status !== 'unsubscribed') {
    await db.from('crm_contacts').update({ newsletter_status: 'unsubscribed' }).eq('id', id);
    await db.from('crm_activities').insert({ contact_id: id, kind: 'note', body: 'Unsubscribed from the newsletter.' });
  }
  return true;
}

// ------------------------------------------------------------ audience

interface Recipient { id: string; name: string; email: string }

export async function audienceFor(db: SupabaseClient, n: Pick<Newsletter, 'audience' | 'audience_tag'>): Promise<Recipient[]> {
  let query = db
    .from('crm_contacts')
    .select('id, name, email, portal_client_id, tags')
    .eq('newsletter_status', 'subscribed')
    .not('email', 'is', null);
  if (n.audience === 'tag') {
    if (!n.audience_tag) return [];
    query = query.contains('tags', [n.audience_tag]);
  }
  const { data, error } = await query;
  if (error) throw new NewsletterError(error.message);
  let rows = data ?? [];

  if (n.audience === 'clients' || n.audience === 'leads') {
    const { data: won } = await db.from('crm_deals').select('contact_id').eq('stage', 'won');
    const clients = new Set((won ?? []).map((d) => d.contact_id));
    const isClient = (r: { id: string; portal_client_id: string | null }) => Boolean(r.portal_client_id) || clients.has(r.id);
    rows = rows.filter((r) => (n.audience === 'clients' ? isClient(r) : !isClient(r)));
  }
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email as string }));
}

// ------------------------------------------------------------- sending

function messageFor(n: Newsletter, r: Recipient, site: string, address: string, from: string) {
  const token = signToken(r.id, 'unsubscribe');
  const unsubscribeUrl = `${site}/newsletter/unsubscribe/${token}`;
  const oneClick = `${site}/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`;
  const { html, text } = renderNewsletter(n, { site, unsubscribeUrl, postalAddress: address, firstName: firstName(r.name) });
  return {
    from,
    to: r.email,
    subject: n.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

function ready(n: Newsletter, address: string | null) {
  if (!address) throw new NewsletterError('Add your mailing address first — the law requires it in every marketing email.');
  if (!n.subject.trim()) throw new NewsletterError('Add a subject line');
  if (!n.body.trim()) throw new NewsletterError('Write the newsletter first');
  return address;
}

export async function sendTest(db: SupabaseClient, n: Newsletter, to: string, site: string) {
  const address = ready(n, await postalAddress(db));
  const { client, from } = resend();
  const msg = messageFor(n, { id: '00000000-0000-0000-0000-000000000000', name: 'Lauren', email: to }, site, address, from);
  const { error } = await client.emails.send({ ...msg, subject: `[Test] ${n.subject}` });
  if (error) throw new NewsletterError(error.message);
}

export async function sendNewsletter(db: SupabaseClient, id: string, site: string) {
  // Claim it: only a draft or a failed send can start, so two clicks can't
  // send twice.
  const { data: claimed } = await db
    .from('newsletters')
    .update({ status: 'sending', last_error: null })
    .eq('id', id)
    .in('status', ['draft', 'failed'])
    .select('*')
    .maybeSingle();
  if (!claimed) throw new NewsletterError('This newsletter is already sending or has been sent');
  const n = claimed as Newsletter;

  const fail = async (message: string) => {
    await db.from('newsletters').update({ status: 'failed', last_error: message }).eq('id', id);
    throw new NewsletterError(message);
  };

  let address: string;
  try {
    address = ready(n, await postalAddress(db));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Not ready to send');
  }
  const { client, from } = resend();

  const [audience, already] = await Promise.all([
    audienceFor(db, n),
    db.from('newsletter_sends').select('contact_id').eq('newsletter_id', id).eq('status', 'sent'),
  ]);
  const done = new Set((already.data ?? []).map((r) => r.contact_id));
  const recipients = audience.filter((r) => !done.has(r.id));
  if (!recipients.length && !done.size) return fail('Nobody in this audience is subscribed yet');

  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);
    const { data, error } = await client.batch.send(
      chunk.map((r) => messageFor(n, r, site, address, from)),
      // Same key for the same recipients: a retry can't double-send a batch.
      { idempotencyKey: `newsletter-${id}-${chunk[0].id}-${chunk.length}` },
    );
    const results = (data as { data?: { id: string }[] } | null)?.data ?? [];
    await db.from('newsletter_sends').upsert(
      chunk.map((r, j) => ({
        newsletter_id: id,
        contact_id: r.id,
        email: r.email,
        status: error ? 'failed' : 'sent',
        error: error?.message ?? null,
        resend_id: results[j]?.id ?? null,
        sent_at: new Date().toISOString(),
      })),
      { onConflict: 'newsletter_id,contact_id' },
    );
    if (error) return fail(`Stopped after ${i} of ${recipients.length}: ${error.message}. Sending again only emails the rest.`);
    // Resend allows a couple of requests a second.
    if (i + BATCH < recipients.length) await new Promise((r) => setTimeout(r, 600));
  }

  const { count } = await db
    .from('newsletter_sends')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', id)
    .eq('status', 'sent');
  await db.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: count ?? 0 }).eq('id', id);
  return { sent: count ?? 0 };
}
