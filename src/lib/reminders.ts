// Admin reminders: nudge a client about something waiting on them.
//
// Each kind of target knows who to contact, whether a reminder still makes
// sense (a paid invoice does not need one), and what to say. Every send is
// logged to client_reminders, successful or not, so admin can see when a
// client was last chased and on which channel.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  crmContact,
  deliver,
  portalContact,
  proposalClientContact,
  smsBlockedReason,
  type ClientMessage,
  type Contact,
  type DeliveryReport,
} from '@/lib/clientNotify';

export const reminderTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invoice'), id: z.string().uuid() }),
  z.object({ kind: z.literal('portal_proposal'), id: z.string().uuid() }),
  z.object({ kind: z.literal('proposal'), id: z.string().uuid() }),
  z.object({ kind: z.literal('onboarding'), clientId: z.string().uuid() }),
  z.object({
    kind: z.literal('custom'),
    clientId: z.string().uuid(),
    // Optional so the dialog can preview before a subject is typed.
    subject: z.string().trim().max(160).optional(),
  }),
  // A free-form message to anyone in the CRM, portal login or not.
  z.object({
    kind: z.literal('crm_contact'),
    id: z.string().uuid(),
    subject: z.string().trim().max(160).optional(),
  }),
]);

export type ReminderTarget = z.infer<typeof reminderTargetSchema>;

/** Targets whose note is the whole message, with a subject Lauren writes. */
function isFreeForm(
  target: ReminderTarget,
): target is Extract<ReminderTarget, { kind: 'custom' | 'crm_contact' }> {
  return target.kind === 'custom' || target.kind === 'crm_contact';
}

export const sendReminderSchema = z
  .object({
    target: reminderTargetSchema,
    channels: z.object({ email: z.boolean(), sms: z.boolean() }),
    note: z.string().trim().max(600).optional(),
  })
  .refine((v) => v.channels.email || v.channels.sms, { message: 'Choose email, text, or both' })
  .refine((v) => !isFreeForm(v.target) || Boolean(v.target.subject), {
    message: 'Add a subject',
  })
  .refine((v) => !isFreeForm(v.target) || Boolean(v.note), {
    message: 'Write the message to send',
  });

export type SendReminderInput = z.infer<typeof sendReminderSchema>;

interface Prepared {
  contact: Contact;
  message: ClientMessage;
  /** Short description for the dialog, e.g. "Invoice INV-004 · $1,200 overdue". */
  summary: string;
  targetType: ReminderTarget['kind'];
  targetId: string | null;
}

export class ReminderError extends Error {}

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function day(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

async function prepare(db: SupabaseClient, target: ReminderTarget, site: string): Promise<Prepared> {
  switch (target.kind) {
    case 'invoice': {
      const { data: inv } = await db
        .from('portal_invoices')
        .select('id, client_id, invoice_number, project_name, amount_cents, due_date, status')
        .eq('id', target.id)
        .maybeSingle();
      if (!inv) throw new ReminderError('Invoice not found');
      if (inv.status === 'paid') throw new ReminderError('That invoice is already paid');
      const contact = await portalContact(db, inv.client_id);
      if (!contact) throw new ReminderError('Client not found');

      const overdue = inv.status === 'overdue' || inv.due_date < new Date().toISOString().slice(0, 10);
      const amount = money(inv.amount_cents);
      const when = overdue ? `was due ${day(inv.due_date)}` : `is due ${day(inv.due_date)}`;
      return {
        contact,
        targetType: 'invoice',
        targetId: inv.id,
        summary: `Invoice ${inv.invoice_number} · ${amount} ${overdue ? 'overdue' : `due ${day(inv.due_date)}`}`,
        message: {
          subject: overdue
            ? `Past due: invoice ${inv.invoice_number} — ${amount}`
            : `Reminder: invoice ${inv.invoice_number} — ${amount} due ${day(inv.due_date)}`,
          eyebrow: 'Friendly reminder',
          headline: `Invoice ${inv.invoice_number} for ${amount} ${when}. You can pay it securely in your portal.`,
          detail: [inv.project_name && `Project: ${inv.project_name}`, `Amount: ${amount}`, `Due: ${day(inv.due_date)}`]
            .filter(Boolean)
            .join('\n'),
          ctaUrl: `${site}/portal/invoices`,
          ctaLabel: 'Pay invoice',
          sms: `Friendly reminder, invoice ${inv.invoice_number} for ${amount} ${when}. Pay here:`,
        },
      };
    }

    case 'portal_proposal': {
      const { data: p } = await db
        .from('portal_proposals')
        .select('id, client_id, name, status')
        .eq('id', target.id)
        .maybeSingle();
      if (!p) throw new ReminderError('Proposal not found');
      if (p.status === 'signed') throw new ReminderError('That proposal is already signed');
      const contact = await portalContact(db, p.client_id);
      if (!contact) throw new ReminderError('Client not found');
      return {
        contact,
        targetType: 'portal_proposal',
        targetId: p.id,
        summary: `Proposal · ${p.name}`,
        message: {
          subject: `Reminder: your proposal is waiting — ${p.name}`,
          eyebrow: 'Friendly reminder',
          headline: `"${p.name}" is still waiting for your review and signature.`,
          detail: 'Download it from your portal, sign, and upload it back when you are ready.',
          ctaUrl: `${site}/portal/files`,
          ctaLabel: 'Review proposal',
          sms: `Friendly reminder, your proposal "${p.name}" is waiting for your signature:`,
        },
      };
    }

    case 'proposal': {
      const { data: p } = await db
        .from('proposals')
        .select('id, slug, access_token, title, status, client_id, valid_until, total_cents, currency')
        .eq('id', target.id)
        .maybeSingle();
      if (!p) throw new ReminderError('Proposal not found');
      if (p.status === 'draft') throw new ReminderError('Publish the proposal before sending a reminder');
      if (p.status === 'signed') throw new ReminderError('That proposal is already signed');
      if (p.status === 'declined') throw new ReminderError('The client declined this proposal');
      if (!p.client_id) throw new ReminderError('This proposal has no client attached');
      const contact = await proposalClientContact(db, p.client_id);
      if (!contact) throw new ReminderError('Client not found');

      const expires = p.valid_until ? ` It is valid until ${day(p.valid_until)}.` : '';
      return {
        contact,
        targetType: 'proposal',
        targetId: p.id,
        summary: `Proposal · ${p.title} · ${money(p.total_cents, p.currency)}`,
        message: {
          subject: `Reminder: ${p.title}`,
          eyebrow: 'Friendly reminder',
          headline: `Your proposal "${p.title}" is ready for you to review and approve.${expires}`,
          detail: 'You can read it, ask questions, and sign online in a couple of minutes.',
          ctaUrl: `${site}/p/${p.slug}?t=${p.access_token}`,
          ctaLabel: 'Review proposal',
          sms: `Friendly reminder, your proposal "${p.title}" is ready to review and sign:`,
        },
      };
    }

    case 'onboarding': {
      const contact = await portalContact(db, target.clientId);
      if (!contact) throw new ReminderError('Client not found');
      const { data: steps } = await db
        .from('portal_onboarding_steps')
        .select('title, completed')
        .eq('client_id', target.clientId)
        .order('step_number');
      const open = (steps ?? []).filter((s) => !s.completed);
      if (open.length === 0) throw new ReminderError('Onboarding is already complete');
      return {
        contact,
        targetType: 'onboarding',
        targetId: null,
        summary: `Onboarding · ${open.length} step${open.length === 1 ? '' : 's'} left`,
        message: {
          subject: 'Reminder: a few onboarding steps left',
          eyebrow: 'Friendly reminder',
          headline: `You have ${open.length} onboarding step${open.length === 1 ? '' : 's'} left before we can get fully underway.`,
          detail: open.map((s) => `• ${s.title}`).join('\n'),
          ctaUrl: `${site}/portal/onboarding`,
          ctaLabel: 'Finish onboarding',
          sms: `Friendly reminder, you have ${open.length} onboarding step${open.length === 1 ? '' : 's'} left. Finish here:`,
        },
      };
    }

    case 'custom': {
      const contact = await portalContact(db, target.clientId);
      if (!contact) throw new ReminderError('Client not found');
      return {
        contact,
        targetType: 'custom',
        targetId: null,
        summary: 'Custom message',
        message: {
          subject: target.subject || 'A note from Thrive Creative Studios',
          eyebrow: 'A note from Thrive Creative Studios',
          headline: '',
          ctaUrl: `${site}/portal/dashboard`,
          ctaLabel: 'Open your portal',
          // The note is the whole message; smsText appends it.
          sms: '',
        },
      };
    }

    case 'crm_contact': {
      const contact = await crmContact(db, target.id);
      if (!contact) throw new ReminderError('Contact not found');
      const portal = Boolean(contact.portalClientId);
      return {
        contact,
        targetType: 'crm_contact',
        targetId: target.id,
        summary: 'Message',
        message: {
          subject: target.subject || 'A note from Thrive Creative Studios',
          eyebrow: 'A note from Thrive Creative Studios',
          headline: '',
          // Only portal clients have somewhere to go.
          ctaUrl: portal ? `${site}/portal/dashboard` : '',
          ctaLabel: portal ? 'Open your portal' : '',
          sms: '',
        },
      };
    }
  }
}

export interface ReminderLogRow {
  id: string;
  target_type: string;
  target_id: string | null;
  subject: string;
  note: string | null;
  email_status: string;
  email_to: string | null;
  email_error: string | null;
  sms_status: string;
  sms_to: string | null;
  sms_error: string | null;
  created_at: string;
}

export async function recentReminders(
  db: SupabaseClient,
  target: ReminderTarget,
  limit = 5,
): Promise<ReminderLogRow[]> {
  let query = db.from('client_reminders').select('*').eq('target_type', target.kind);
  query =
    'id' in target
      ? query.eq('target_id', target.id)
      : query.eq('portal_client_id', target.clientId);
  const { data } = await query.order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as ReminderLogRow[];
}

export interface ReminderPreview {
  summary: string;
  recipient: string;
  email: string | null;
  phone: string | null;
  smsAvailable: boolean;
  smsBlockedReason: string | null;
  /** Set for proposal recipients, whose number can be edited from the dialog. */
  proposalClientId: string | null;
  history: ReminderLogRow[];
}

/** What the reminder dialog shows before anything is sent. */
export async function previewReminder(
  db: SupabaseClient,
  target: ReminderTarget,
  site: string,
): Promise<ReminderPreview> {
  const prepared = await prepare(db, target, site);
  const blocked = smsBlockedReason(prepared.contact);
  return {
    summary: prepared.summary,
    recipient: prepared.contact.name,
    email: prepared.contact.email,
    phone: prepared.contact.phone,
    smsAvailable: !blocked,
    smsBlockedReason: blocked,
    proposalClientId:
      prepared.contact.smsSource === 'portal' ? null : prepared.contact.proposalClientId,
    history: await recentReminders(db, target),
  };
}

export interface ReminderResult extends DeliveryReport {
  reminder: ReminderLogRow | null;
}

export async function sendReminder(
  db: SupabaseClient,
  input: SendReminderInput,
  site: string,
): Promise<ReminderResult> {
  const prepared = await prepare(db, input.target, site);
  const note = input.note || null;
  const message: ClientMessage =
    isFreeForm(input.target)
      ? { ...prepared.message, headline: note ?? '', note: null, sms: note }
      : { ...prepared.message, note };

  const report = await deliver(db, prepared.contact, message, input.channels);

  const { data: reminder, error } = await db
    .from('client_reminders')
    .insert({
      target_type: prepared.targetType,
      target_id: prepared.targetId,
      portal_client_id:
        'clientId' in input.target ? input.target.clientId : prepared.contact.portalClientId,
      proposal_client_id: prepared.contact.proposalClientId,
      subject: message.subject,
      note,
      email_status: report.email.status,
      email_to: report.email.to,
      email_error: report.email.error,
      sms_status: report.sms.status,
      sms_to: report.sms.to,
      sms_error: report.sms.error,
    })
    .select('*')
    .single();
  if (error) console.error('Reminder sent but not logged:', error.message);

  return { ...report, reminder: (reminder as ReminderLogRow | null) ?? null };
}
