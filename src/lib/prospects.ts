// Sending one email to one CRM contact — a prospect before they're a
// client, or anyone else — from an email template, edited for them.
//
// Each email carries the same unsubscribe link as every Thrive email (it
// sets the contact's newsletter_status to 'unsubscribed'), one-click
// List-Unsubscribe headers, and the mailing address, as CAN-SPAM requires
// of any commercial email, cold or not. The Reply-To is the contact's
// signed reply address, so a reply is logged against them (inboundEmail.ts)
// and forwarded to Lauren.
//
// What was sent is recorded in prospect_emails, which the contact's
// timeline reads. Sending also moves a deal still at "New lead" to
// "Contacted".
//
// Before it's sent, an email can be kept in prospect_drafts — one per
// contact — as a plain draft or scheduled for later (the cron in
// scheduledEmails.ts sends it). Sending deletes the draft.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { postalAddress } from '@/lib/newsletter';
import { blockImages, blocksSchema, designSchema, normalizeBlocks } from '@/lib/newsletterBlocks';
import { replyAddress, signToken } from '@/lib/newsletterTokens';
import { REASON, SAMPLE_CONTACT, placeholdersIn, renderEmail, type EmailContent, type EmailTemplate } from '@/lib/emailContent';

export class ProspectError extends Error {}

/** Two sends to one person this close together are a double click. */
const REPEAT_GUARD_MS = 2 * 60_000;

export const sendSchema = z.object({
  /** Optional only for a test from the template editor (a sample person). */
  contact_id: z.string().uuid().optional(),
  template_id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Add a subject line').max(160),
  preheader: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  note: z.string().max(3000).default(''),
  /** Send to Lauren instead, as this contact would see it. */
  test: z.boolean().default(false),
}).refine((v) => v.test || v.contact_id, { message: 'Choose who to send it to' });

export type SendInput = z.infer<typeof sendSchema>;

/** Save what's written for one person; with `scheduled_at`, send it then. */
export const draftSchema = z.object({
  contact_id: z.string().uuid(),
  template_id: z.string().uuid(),
  subject: z.string().max(160).default(''),
  preheader: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  note: z.string().max(3000).default(''),
  scheduled_at: z.string().datetime({ offset: true }).nullable().default(null),
});

export type DraftInput = z.infer<typeof draftSchema>;

export interface ProspectDraft {
  id: string;
  contact_id: string;
  template_id: string | null;
  subject: string;
  preheader: string;
  body: string;
  note: string;
  status: 'draft' | 'scheduled' | 'sending' | 'failed';
  scheduled_at: string | null;
  error: string | null;
  updated_at: string;
}

export const templateUpdateSchema = z.object({
  name: z.string().trim().max(80),
  subject: z.string().max(160),
  preheader: z.string().max(200),
  body: z.string().max(20_000),
  blocks: blocksSchema,
  design: designSchema.partial(),
}).partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export interface ProspectContact {
  id: string;
  name: string;
  firstName: string | null;
  company: string | null;
  email: string | null;
  /** Why this person can't be emailed, if they can't. */
  blocked: string | null;
  /** Subscribers get the newsletter's footer line; everyone else the outreach one. */
  subscribed: boolean;
  prospect: boolean;
}

export interface ProspectSendRow {
  id: string;
  subject: string;
  style: string;
  status: 'sent' | 'failed';
  error: string | null;
  sent_at: string;
}

const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || null;

export async function prospectContact(db: SupabaseClient, id: string): Promise<ProspectContact | null> {
  const { data: c } = await db.from('crm_contacts').select('id, name, company, email, newsletter_status, prospect_status').eq('id', id).maybeSingle();
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    firstName: firstName(c.name),
    company: c.company,
    email: c.email,
    blocked: !c.email
      ? 'No email address on file — add one in Details.'
      : c.newsletter_status === 'unsubscribed'
        ? 'They unsubscribed from Thrive emails, so they can’t be sent marketing email.'
        : null,
    subscribed: c.newsletter_status === 'subscribed',
    prospect: c.prospect_status === 'prospect',
  };
}

export async function prospectHistory(db: SupabaseClient, contactId: string): Promise<ProspectSendRow[]> {
  const { data } = await db
    .from('prospect_emails')
    .select('id, subject, style, status, error, sent_at')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: false })
    .limit(20);
  return (data ?? []) as ProspectSendRow[];
}

function contentFor(t: EmailTemplate, input: SendInput): EmailContent {
  return {
    style: t.style,
    subject: input.subject,
    preheader: input.preheader,
    body: t.style === 'personal' ? input.body : '',
    blocks: t.blocks ?? [],
    design: t.design ?? {},
    note: t.style === 'designed' ? input.note : '',
  };
}

function check(c: EmailContent, test: boolean) {
  if (c.style === 'personal' && !c.body.trim()) throw new ProspectError('Write the message first');
  // A test may still have [[notes]] in it; a real send may not.
  const left = test ? [] : placeholdersIn(c);
  if (left.length) throw new ProspectError(`Fill in ${left[0]} before sending`);
  if (c.style === 'designed') {
    if (!c.blocks.length) throw new ProspectError('This template has no blocks yet');
    const images = normalizeBlocks(c.blocks).flatMap(blockImages);
    if (images.some((i) => !i.src)) throw new ProspectError('A section in the template is still waiting for an image — upload one in the template');
    if (images.some((i) => !i.alt.trim())) throw new ProspectError('Describe every image in the template (alt text)');
  }
}

/** Everything a send checks, short of sending: the contact, the template, the content. */
async function prepare(db: SupabaseClient, input: SendInput, site: string) {
  const [found, address, { data: template }] = await Promise.all([
    input.contact_id ? prospectContact(db, input.contact_id) : null,
    postalAddress(db),
    db.from('email_templates').select('*').eq('id', input.template_id).maybeSingle(),
  ]);
  if (input.contact_id && !found) throw new ProspectError('Contact not found');
  const contact: ProspectContact = found ?? {
    id: '00000000-0000-0000-0000-000000000000', name: SAMPLE_CONTACT.firstName, email: null, blocked: null, subscribed: false, prospect: true, ...SAMPLE_CONTACT,
  };
  if (!template) throw new ProspectError('Template not found');
  if (!address) throw new ProspectError('Add your mailing address on the Emails page first — the law requires it in every marketing email.');
  if (contact.blocked && !input.test) throw new ProspectError(contact.blocked);

  const content = contentFor(template as EmailTemplate, input);
  check(content, input.test);

  const token = signToken(contact.id, 'unsubscribe');
  const { subject, html, text } = renderEmail(content, {
    site,
    reason: contact.subscribed ? REASON.subscriber : REASON.prospect,
    unsubscribeUrl: `${site}/newsletter/unsubscribe/${token}`,
    postalAddress: address,
    firstName: contact.firstName,
    company: contact.company,
  });
  return { contact, content, token, subject, html, text };
}

export async function sendProspect(db: SupabaseClient, input: SendInput, site: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (!key || !from) throw new ProspectError('Email is not set up (RESEND_API_KEY and CONTACT_NOTIFY_FROM)');
  const lauren = process.env.CONTACT_NOTIFY_TO;

  const { contact, content, token, subject, html, text } = await prepare(db, input, site);
  const client = new Resend(key);
  if (input.test) {
    if (!lauren) throw new ProspectError('No test address — set CONTACT_NOTIFY_TO');
    const { error } = await client.emails.send({ from, to: lauren, subject: `[Test] ${subject}`, html, text });
    if (error) throw new ProspectError(error.message);
    return { to: lauren, test: true };
  }

  const { data: recent } = await db
    .from('prospect_emails')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('status', 'sent')
    .gte('sent_at', new Date(Date.now() - REPEAT_GUARD_MS).toISOString())
    .limit(1);
  if (recent?.length) throw new ProspectError('You just emailed them — wait a couple of minutes before sending another.');

  const oneClick = `${site}/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`;
  const replyTo = replyAddress(contact.id, lauren);
  const { data, error } = await client.emails.send({
    from,
    to: contact.email as string,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  await db.from('prospect_emails').insert({
    contact_id: contact.id,
    template_id: input.template_id,
    style: content.style,
    email: contact.email,
    subject,
    body: text,
    status: error ? 'failed' : 'sent',
    error: error?.message ?? null,
    resend_id: data?.id ?? null,
  });
  if (error) throw new ProspectError(error.message);

  // Sent, so the draft for them (if any) is done with.
  await db.from('prospect_drafts').delete().eq('contact_id', contact.id);
  // First outreach: New lead → Contacted. The stage trigger logs it.
  await db.from('crm_deals').update({ stage: 'contacted' }).eq('contact_id', contact.id).eq('stage', 'lead');

  return { to: contact.email as string, test: false };
}

// --------------------------------------------------------------- drafts

const DRAFT_COLUMNS = 'id, contact_id, template_id, subject, preheader, body, note, status, scheduled_at, error, updated_at';

export async function prospectDraft(db: SupabaseClient, contactId: string): Promise<ProspectDraft | null> {
  const { data } = await db.from('prospect_drafts').select(DRAFT_COLUMNS).eq('contact_id', contactId).maybeSingle();
  return (data as ProspectDraft | null) ?? null;
}

/**
 * Save (or replace) the draft for one person. Scheduling checks everything
 * a send would, so a problem shows now rather than when it's due.
 */
export async function saveProspectDraft(db: SupabaseClient, input: DraftInput, site: string): Promise<ProspectDraft> {
  const existing = await prospectDraft(db, input.contact_id);
  if (existing?.status === 'sending') throw new ProspectError('It’s sending right now');
  if (input.scheduled_at) {
    if (!input.subject.trim()) throw new ProspectError('Add a subject line');
    await prepare(db, { ...input, test: false }, site);
  }
  const { data, error } = await db
    .from('prospect_drafts')
    .upsert({
      contact_id: input.contact_id,
      template_id: input.template_id,
      subject: input.subject,
      preheader: input.preheader,
      body: input.body,
      note: input.note,
      status: input.scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: input.scheduled_at,
      error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'contact_id' })
    .select(DRAFT_COLUMNS)
    .single();
  if (error) throw new ProspectError(error.message);
  return data as ProspectDraft;
}

/** Send a scheduled draft (the cron). Claims it first so it can't go twice. */
export async function sendProspectDraft(db: SupabaseClient, id: string, site: string) {
  const { data: d } = await db
    .from('prospect_drafts')
    .update({ status: 'sending', error: null })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select(DRAFT_COLUMNS)
    .maybeSingle();
  if (!d) return null;
  const draft = d as ProspectDraft;
  try {
    if (!draft.template_id) throw new ProspectError('Its template was deleted');
    return await sendProspect(db, {
      contact_id: draft.contact_id, template_id: draft.template_id, subject: draft.subject,
      preheader: draft.preheader, body: draft.body, note: draft.note, test: false,
    }, site);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not send';
    await db.from('prospect_drafts').update({ status: 'failed', error: message }).eq('id', id);
    throw new ProspectError(message);
  }
}
