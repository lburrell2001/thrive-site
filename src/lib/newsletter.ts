// Emails to many people at once — newsletters to subscribers, outreach to
// prospects — plus signing up, confirming and unsubscribing. (The table is
// still called newsletters; every email sent to an audience lives there.)
//
// Subscription lives on the CRM contact (crm_contacts.newsletter_status).
// Subscriber audiences reach only 'subscribed' contacts. Prospect and
// hand-picked audiences reach anyone with an email who hasn't
// unsubscribed. Footer signups are double opt-in: they stay 'pending' until
// the confirm link is clicked, so nobody can put someone else's address on
// the list.
//
// Sending goes through Resend's batch API, 100 at a time, each recipient
// with their own unsubscribe link and one-click List-Unsubscribe headers.
// Every recipient is recorded in newsletter_sends; a failed send can be
// retried and only reaches the people it missed. Each one's Reply-To is
// their signed reply address, so replies land on their CRM record.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { REASON, placeholdersIn, renderEmail, type EmailStyle } from '@/lib/emailContent';
import { blockImages, normalizeBlocks, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';
import { replyAddress, signToken, verifyToken } from '@/lib/newsletterTokens';

export class NewsletterError extends Error {}

// Audience lives with the renderer so browser code can use it too.
import { OUTREACH, type Audience } from '@/lib/emailContent';
export { OUTREACH, type Audience };

export interface Newsletter {
  id: string;
  /** Null for older newsletters: markdown body, or an imported design. */
  style: EmailStyle | null;
  subject: string;
  preheader: string;
  body: string;
  /** Designed newsletters: when non-empty, rendered instead of `body`. */
  blocks: NewsletterBlock[];
  design: Partial<NewsletterDesign>;
  /** An imported design (Canva Email), sanitized; wins over blocks and body. */
  html: string | null;
  html_meta: { file: string; images: number; bytes: number; warnings: string[]; imported_at: string } | null;
  audience: Audience;
  audience_tag: string | null;
  /** The hand-picked audience. */
  audience_contact_ids: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  /** When a scheduled email goes out (the cron runs every five minutes). */
  scheduled_at: string | null;
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
    await db.from('crm_activities').insert({ contact_id: id, kind: 'note', body: 'Unsubscribed from Thrive emails (newsletter and outreach).' });
  }
  return true;
}

// ------------------------------------------------------------ audience

interface Recipient { id: string; name: string; email: string; company: string | null }

export async function audienceFor(
  db: SupabaseClient,
  n: Pick<Newsletter, 'audience' | 'audience_tag' | 'audience_contact_ids'>,
): Promise<Recipient[]> {
  let query = db
    .from('crm_contacts')
    .select('id, name, email, company, portal_client_id, tags')
    .not('email', 'is', null);

  if (OUTREACH.includes(n.audience)) {
    // Not subscribers, but never anyone who said no.
    query = query.or('newsletter_status.is.null,newsletter_status.neq.unsubscribed');
    if (n.audience === 'contacts') {
      if (!n.audience_contact_ids?.length) return [];
      query = query.in('id', n.audience_contact_ids);
    } else {
      query = query.eq('prospect_status', 'prospect');
      if (n.audience === 'prospect_tag') {
        if (!n.audience_tag) return [];
        query = query.contains('tags', [n.audience_tag]);
      }
    }
  } else {
    query = query.eq('newsletter_status', 'subscribed');
    if (n.audience === 'tag') {
      if (!n.audience_tag) return [];
      query = query.contains('tags', [n.audience_tag]);
    }
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
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email as string, company: r.company }));
}

// ------------------------------------------------------------- sending

function messageFor(n: Newsletter, r: Recipient, site: string, address: string, from: string) {
  const token = signToken(r.id, 'unsubscribe');
  const unsubscribeUrl = `${site}/newsletter/unsubscribe/${token}`;
  const oneClick = `${site}/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`;
  const { subject, html, text } = renderEmail(
    { style: n.style, subject: n.subject, preheader: n.preheader, body: n.body, blocks: n.blocks ?? [], design: n.design ?? {}, html: n.html },
    {
      site, unsubscribeUrl, postalAddress: address, firstName: firstName(r.name), company: r.company,
      reason: OUTREACH.includes(n.audience) ? REASON.prospect : REASON.subscriber,
    },
  );
  const replyTo = replyAddress(r.id, process.env.CONTACT_NOTIFY_TO);
  return {
    from,
    to: r.email,
    ...(replyTo ? { replyTo } : {}),
    subject,
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
  if (n.html?.trim()) return address;
  if (!n.body.trim() && !(n.blocks ?? []).length) throw new NewsletterError('Write the email first');
  const left = placeholdersIn({ style: n.style, subject: n.subject, preheader: n.preheader, body: n.body, blocks: n.blocks ?? [] });
  if (left.length) throw new NewsletterError(`Replace ${left[0]} before sending — it's a note to yourself`);
  const images = normalizeBlocks(n.blocks).flatMap(blockImages);
  if (images.some((i) => !i.src)) throw new NewsletterError('A section is still waiting for an image — upload one or remove it');
  if (images.some((i) => !i.alt.trim())) throw new NewsletterError('Describe every image (alt text) — it is what people see when images are blocked');
  return address;
}

export async function sendTest(db: SupabaseClient, n: Newsletter, to: string, site: string) {
  const address = ready(n, await postalAddress(db));
  const { client, from } = resend();
  const msg = messageFor(n, { id: '00000000-0000-0000-0000-000000000000', name: 'Lauren', email: to, company: 'Thrive Creative Studios' }, site, address, from);
  const { error } = await client.emails.send({ ...msg, subject: `[Test] ${n.subject}` });
  if (error) throw new NewsletterError(error.message);
}

const UNSENT: Newsletter['status'][] = ['draft', 'failed', 'scheduled'];

/**
 * Send it later. Checked now as if sending, so a problem shows up while
 * Lauren is looking, not in the middle of the night; checked again at send
 * time, when the audience is worked out afresh.
 */
export async function scheduleNewsletter(db: SupabaseClient, id: string, at: Date) {
  const { data } = await db.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (!data) throw new NewsletterError('Email not found');
  const n = data as Newsletter;
  if (!UNSENT.includes(n.status)) throw new NewsletterError('This email is already sending or has been sent');
  ready(n, await postalAddress(db));
  if (!(await audienceFor(db, n)).length) {
    throw new NewsletterError(OUTREACH.includes(n.audience) ? 'Nobody in this audience can be emailed' : 'Nobody in this audience is subscribed yet');
  }
  const { data: updated, error } = await db
    .from('newsletters')
    .update({ status: 'scheduled', scheduled_at: at.toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', UNSENT)
    .select('*')
    .maybeSingle();
  if (error) throw new NewsletterError(error.message);
  if (!updated) throw new NewsletterError('This email is already sending or has been sent');
  return updated as Newsletter;
}

/** Back to a draft. Refused once the cron has started sending it. */
export async function unscheduleNewsletter(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from('newsletters')
    .update({ status: 'draft', scheduled_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('*')
    .maybeSingle();
  if (error) throw new NewsletterError(error.message);
  if (!data) throw new NewsletterError('It’s already sending or has been sent');
  return data as Newsletter;
}

/**
 * `from` is which statuses may start a send: the cron passes only
 * 'scheduled', so an email unscheduled a moment ago stays put.
 */
export async function sendNewsletter(db: SupabaseClient, id: string, site: string, from: Newsletter['status'][] = UNSENT) {
  // Claim it: only an unsent email can start, so two clicks (or a click
  // and the cron) can't send twice.
  const { data: claimed } = await db
    .from('newsletters')
    .update({ status: 'sending', last_error: null })
    .eq('id', id)
    .in('status', from)
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
  const { client, from: sender } = resend();

  const [audience, already] = await Promise.all([
    audienceFor(db, n),
    db.from('newsletter_sends').select('contact_id').eq('newsletter_id', id).eq('status', 'sent'),
  ]);
  const done = new Set((already.data ?? []).map((r) => r.contact_id));
  const recipients = audience.filter((r) => !done.has(r.id));
  if (!recipients.length && !done.size) return fail(OUTREACH.includes(n.audience) ? 'Nobody in this audience can be emailed' : 'Nobody in this audience is subscribed yet');

  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);
    const { data, error } = await client.batch.send(
      chunk.map((r) => messageFor(n, r, site, address, sender)),
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
