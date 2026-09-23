// Reaching a client by email and text.
//
// There are two kinds of client: portal clients (a login, email on the auth
// user) and proposal recipients (proposal_clients, which may or may not be
// linked to a portal login). Both resolve to a Contact here so every sender —
// portal update notifications and admin reminders alike — goes through one
// path that knows the consent rule: a text is only sent when the client has a
// number AND has opted in.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendSms, smsConfigured } from '@/lib/sms';

export interface Contact {
  portalClientId: string | null;
  proposalClientId: string | null;
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  smsOptIn: boolean;
  /** Which table the phone and consent came from, so a STOP can be recorded. */
  smsSource: 'portal' | 'proposal' | null;
}

export interface ClientMessage {
  subject: string;
  /** Small line in the email header, e.g. "Friendly reminder". */
  eyebrow?: string;
  headline: string;
  detail?: string;
  /** A personal line from Lauren, shown on its own. */
  note?: string | null;
  /** Empty for a message with no button, e.g. to a lead with no portal. */
  ctaUrl: string;
  ctaLabel: string;
  /** Text message body without the brand prefix or link; null for no text. */
  sms?: string | null;
}

export type ChannelStatus = 'sent' | 'failed' | 'skipped';

export interface ChannelReport {
  status: ChannelStatus;
  to: string | null;
  error: string | null;
}

export interface DeliveryReport {
  email: ChannelReport;
  sms: ChannelReport;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

export async function portalContact(db: SupabaseClient, clientId: string): Promise<Contact | null> {
  const [authRes, profileRes] = await Promise.all([
    db.auth.admin.getUserById(clientId),
    db.from('portal_clients').select('full_name, phone, sms_opt_in').eq('id', clientId).maybeSingle(),
  ]);
  if (!profileRes.data) return null;
  const name = profileRes.data.full_name ?? '';
  return {
    portalClientId: clientId,
    proposalClientId: null,
    name,
    firstName: firstNameOf(name),
    email: authRes.data.user?.email ?? null,
    phone: profileRes.data.phone ?? null,
    smsOptIn: Boolean(profileRes.data.sms_opt_in),
    smsSource: profileRes.data.phone ? 'portal' : null,
  };
}

export async function proposalClientContact(
  db: SupabaseClient,
  proposalClientId: string,
): Promise<Contact | null> {
  const { data } = await db
    .from('proposal_clients')
    .select('id, name, email, phone, sms_opt_in, portal_client_id')
    .eq('id', proposalClientId)
    .maybeSingle();
  if (!data) return null;

  const own: Contact = {
    portalClientId: data.portal_client_id ?? null,
    proposalClientId: data.id,
    name: data.name ?? '',
    firstName: firstNameOf(data.name ?? ''),
    email: data.email ?? null,
    phone: data.phone ?? null,
    smsOptIn: Boolean(data.sms_opt_in),
    smsSource: data.phone ? 'proposal' : null,
  };
  if (!data.portal_client_id) return own;

  // A recipient with a portal login: the proposal is addressed to the email on
  // the proposal record, but the texting preference they set themselves in
  // the portal wins when they have given a number there.
  const portal = await portalContact(db, data.portal_client_id);
  if (!portal) return own;
  return {
    ...own,
    email: own.email ?? portal.email,
    ...(portal.phone
      ? { phone: portal.phone, smsOptIn: portal.smsOptIn, smsSource: 'portal' as const }
      : {}),
  };
}

/**
 * A CRM contact: through their portal login when they have one, else their
 * most recent proposal recipient record (both carry text consent), else the
 * contact's own email. A contact with neither has never agreed to texts, so
 * they can only be emailed.
 */
export async function crmContact(db: SupabaseClient, crmContactId: string): Promise<Contact | null> {
  const { data } = await db
    .from('crm_contacts')
    .select('id, name, email, phone, portal_client_id, proposal_clients ( id, created_at )')
    .eq('id', crmContactId)
    .maybeSingle();
  if (!data) return null;

  const linked = data.portal_client_id
    ? await portalContact(db, data.portal_client_id)
    : null;
  if (linked) return { ...linked, email: linked.email ?? data.email ?? null };

  const recipients = ((data.proposal_clients ?? []) as { id: string; created_at: string }[])
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  if (recipients[0]) {
    const viaProposal = await proposalClientContact(db, recipients[0].id);
    if (viaProposal) return { ...viaProposal, email: viaProposal.email ?? data.email ?? null };
  }

  const name = data.name ?? '';
  return {
    portalClientId: null,
    proposalClientId: null,
    name,
    firstName: firstNameOf(name),
    email: data.email ?? null,
    phone: data.phone ?? null,
    smsOptIn: false,
    smsSource: null,
  };
}

/** Why a text cannot go to this contact, or null if it can. */
export function smsBlockedReason(contact: Contact): string | null {
  if (!smsConfigured()) return 'Text messages are not set up yet';
  if (!contact.phone) return 'No mobile number on file';
  if (!contact.smsOptIn) {
    return contact.smsSource
      ? 'Client has not agreed to receive texts'
      : 'No text consent on file — send a proposal or portal invite first';
  }
  return null;
}

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emailHtml(contact: Contact, m: ClientMessage): string {
  return `
    <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:28px;">
        <div style="background:linear-gradient(135deg,#ff2ea6,#7c3aed,#22d3ee);padding:2px;border-radius:18px;">
          <div style="background:#0b0b0f;border-radius:16px;padding:20px 22px 16px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:12px;height:12px;border-radius:999px;background:#ff2ea6;box-shadow:0 0 0 4px rgba(255,46,166,.18);"></div>
              <div style="color:#fff;font-weight:900;font-size:15px;">Thrive Creative Studios</div>
            </div>
            <div style="margin-top:6px;color:#d7d7e0;font-size:13px;">${esc(m.eyebrow ?? 'Your client portal has been updated.')}</div>
          </div>
        </div>
        <div style="margin-top:16px;background:#11111a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;">
          <div style="color:#fff;font-size:17px;font-weight:900;margin-bottom:6px;">Hi ${esc(contact.firstName)},</div>
          <div style="color:#d7d7e0;font-size:14px;line-height:1.6;margin-bottom:8px;white-space:pre-line;">${esc(m.headline)}</div>
          ${m.detail ? `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px 16px;color:#fff;font-size:13px;line-height:1.6;margin-bottom:16px;white-space:pre-line;">${esc(m.detail)}</div>` : ''}
          ${m.note ? `<div style="border-left:3px solid #ff2ea6;padding:4px 0 4px 14px;color:#fff;font-size:14px;line-height:1.6;margin-bottom:16px;white-space:pre-line;">${esc(m.note)}</div>` : ''}
          ${m.ctaUrl ? `<a href="${esc(m.ctaUrl)}" style="display:inline-block;background:#ff2ea6;color:#0b0b0f;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;">${esc(m.ctaLabel)} →</a>` : ''}
        </div>
        <div style="margin-top:14px;color:#6c7386;font-size:12px;text-align:center;">
          Thrive Creative Studios · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  `;
}

function emailText(contact: Contact, m: ClientMessage): string {
  return [
    `Hi ${contact.firstName},`,
    m.headline,
    m.detail,
    m.note,
    m.ctaUrl && `${m.ctaLabel}:\n${m.ctaUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function smsText(m: ClientMessage): string {
  const note = m.note ? `\n\n${m.note.trim()}` : '';
  const link = m.ctaUrl ? ` ${m.ctaUrl}` : '';
  return `Thrive Creative Studios: ${m.sms}${link}${note}\n\nReply STOP to opt out.`;
}

const SKIPPED: ChannelReport = { status: 'skipped', to: null, error: null };

/**
 * Send a message on the requested channels. Never throws; each channel's
 * outcome comes back in the report.
 */
export async function deliver(
  db: SupabaseClient,
  contact: Contact,
  message: ClientMessage,
  channels: { email: boolean; sms: boolean },
): Promise<DeliveryReport> {
  const emailTask = async (): Promise<ChannelReport> => {
    if (!channels.email) return SKIPPED;
    if (!contact.email) return { status: 'skipped', to: null, error: 'No email address on file' };
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.CONTACT_NOTIFY_FROM;
    if (!apiKey || !from) {
      return { status: 'failed', to: contact.email, error: 'Email is not set up (Resend env vars missing)' };
    }
    try {
      const { error } = await new Resend(apiKey).emails.send({
        from,
        to: contact.email,
        subject: message.subject,
        html: emailHtml(contact, message),
        text: emailText(contact, message),
      });
      if (error) return { status: 'failed', to: contact.email, error: error.message };
      return { status: 'sent', to: contact.email, error: null };
    } catch (error) {
      return {
        status: 'failed',
        to: contact.email,
        error: error instanceof Error ? error.message : 'Email failed to send',
      };
    }
  };

  const smsTask = async (): Promise<ChannelReport> => {
    if (!channels.sms || !message.sms) return SKIPPED;
    const blocked = smsBlockedReason(contact);
    if (blocked) return { status: 'skipped', to: contact.phone, error: blocked };

    const result = await sendSms(contact.phone!, smsText(message));
    if (result.ok) return { status: 'sent', to: result.to, error: null };

    // They replied STOP at some point. Record it so nobody tries again.
    if (result.optedOut) {
      if (contact.smsSource === 'portal' && contact.portalClientId) {
        await db.from('portal_clients').update({ sms_opt_in: false }).eq('id', contact.portalClientId);
      } else if (contact.smsSource === 'proposal' && contact.proposalClientId) {
        await db.from('proposal_clients').update({ sms_opt_in: false }).eq('id', contact.proposalClientId);
      }
      return { status: 'failed', to: result.to, error: 'Client replied STOP — texts are now off for them' };
    }
    return { status: 'failed', to: result.to, error: result.error };
  };

  const [email, sms] = await Promise.all([emailTask(), smsTask()]);
  return { email, sms };
}

/**
 * Fire-and-forget portal update: email always, text too when the message has
 * a text body and the client has opted in. Failures are logged.
 */
export async function notifyPortalClient(
  db: SupabaseClient,
  clientId: string,
  message: ClientMessage,
): Promise<void> {
  try {
    const contact = await portalContact(db, clientId);
    if (!contact) return;
    const report = await deliver(db, contact, message, { email: true, sms: Boolean(message.sms) });
    if (report.email.status === 'failed') console.error('Client email failed:', report.email.error);
    if (report.sms.status === 'failed') console.error('Client text failed:', report.sms.error);
  } catch (error) {
    console.error('Client notification failed:', error);
  }
}
