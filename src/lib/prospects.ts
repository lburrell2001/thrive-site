// Sending a prospect email to one CRM contact.
//
// Each email carries the same unsubscribe link as newsletters (it sets the
// contact's newsletter_status to 'unsubscribed'), one-click List-Unsubscribe
// headers, and the mailing address, as CAN-SPAM requires of any commercial
// email, cold or not. Replies go to Lauren's inbox.
//
// What was sent is recorded in prospect_emails, which the contact's
// timeline reads. Sending also moves a deal still at "New lead" to
// "Contacted".

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { postalAddress } from '@/lib/newsletter';
import { blockImages, blocksSchema, designSchema, normalizeBlocks } from '@/lib/newsletterBlocks';
import { signToken } from '@/lib/newsletterTokens';
import { SAMPLE_CONTACT, placeholdersIn, renderProspect, type ProspectContent, type ProspectTemplate } from '@/lib/prospectEmail';

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
  const { data: c } = await db.from('crm_contacts').select('id, name, company, email, newsletter_status').eq('id', id).maybeSingle();
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

function contentFor(t: ProspectTemplate, input: SendInput): ProspectContent {
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

function check(c: ProspectContent, test: boolean) {
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

export async function sendProspect(db: SupabaseClient, input: SendInput, site: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (!key || !from) throw new ProspectError('Email is not set up (RESEND_API_KEY and CONTACT_NOTIFY_FROM)');
  const replyTo = process.env.CONTACT_NOTIFY_TO;

  const [found, address, { data: template }] = await Promise.all([
    input.contact_id ? prospectContact(db, input.contact_id) : null,
    postalAddress(db),
    db.from('prospect_templates').select('*').eq('id', input.template_id).maybeSingle(),
  ]);
  if (input.contact_id && !found) throw new ProspectError('Contact not found');
  const contact: ProspectContact = found ?? {
    id: '00000000-0000-0000-0000-000000000000', name: SAMPLE_CONTACT.firstName, email: null, blocked: null, ...SAMPLE_CONTACT,
  };
  if (!template) throw new ProspectError('Template not found');
  if (!address) throw new ProspectError('Add your mailing address on the Newsletters page first — the law requires it in every marketing email.');
  if (contact.blocked && !input.test) throw new ProspectError(contact.blocked);

  const content = contentFor(template as ProspectTemplate, input);
  check(content, input.test);

  const token = signToken(contact.id, 'unsubscribe');
  const { subject, html, text } = renderProspect(content, {
    site,
    unsubscribeUrl: `${site}/newsletter/unsubscribe/${token}`,
    postalAddress: address,
    firstName: contact.firstName,
    company: contact.company,
  });

  const client = new Resend(key);
  if (input.test) {
    if (!replyTo) throw new ProspectError('No test address — set CONTACT_NOTIFY_TO');
    const { error } = await client.emails.send({ from, to: replyTo, subject: `[Test] ${subject}`, html, text });
    if (error) throw new ProspectError(error.message);
    return { to: replyTo, test: true };
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

  // First outreach: New lead → Contacted. The stage trigger logs it.
  await db.from('crm_deals').update({ stage: 'contacted' }).eq('contact_id', contact.id).eq('stage', 'lead');

  return { to: contact.email as string, test: false };
}
