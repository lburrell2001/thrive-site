// Signing emails: a receipt to the client, a notification to Lauren.
//
// Both are best-effort. A signature is recorded in the database before any
// mail is attempted, and a mail failure never fails the signing — the client
// has already agreed, and losing that because an SMTP call timed out would
// be the worse outcome. Failures are logged instead.

import 'server-only';
import { Resend } from 'resend';
import { BRAND, brandEmail, button, esc, links, note, paragraph, rows, signoff } from '@/lib/emailLayout';

export interface SigningEmailData {
  proposalTitle: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string | null;
  typedName: string;
  signedAt: string;
  totalLabel: string;
  depositLabel: string;
  depositPercent: number;
  proposalUrl: string;
  printUrl: string;
  portalUrl: string;
  adminUrl: string;
  contentHash: string;
  ipAddress: string | null;
  /** The rendered proposal, attached to the client's receipt when available. */
  pdf?: { filename: string; content: Buffer } | null;
}

/** Sent to the client. Restates what they approved and what happens next. */
function clientReceipt(d: SigningEmailData) {
  return brandEmail({
    title: `Approved — ${d.proposalTitle}`,
    preheader: `Your receipt for ${d.proposalTitle}. Next step: the ${d.depositPercent}% deposit.`,
    eyebrow: 'Proposal approved',
    heading: 'Thank you!',
    body: [
      paragraph(
        `You approved <strong style="color:#000;">${esc(d.proposalTitle)}</strong> on ${esc(d.signedAt)}. This email is your receipt, so keep it for your records.`,
        { html: true },
      ),
      rows([
        { label: 'Signed by', value: d.typedName },
        { label: 'Total', value: d.totalLabel },
        { label: `Deposit due (${d.depositPercent}%)`, value: d.depositLabel, strong: true },
      ]),
      paragraph('Next step: pay the deposit in your client portal. Work begins as soon as it lands.'),
      button(d.portalUrl, 'Pay the deposit'),
      links([
        { href: d.proposalUrl, label: 'Read the proposal again' },
        { href: d.printUrl, label: 'Save a PDF copy' },
      ]),
      signoff(),
    ].join('\n'),
  });
}

/** Sent to Lauren. Carries the audit detail, which the client's copy does not. */
function agencyNotification(d: SigningEmailData) {
  return brandEmail({
    title: `Signed: ${d.proposalTitle}`,
    eyebrow: 'Proposal signed',
    heading: d.proposalTitle,
    body: [
      paragraph(`${d.signerName}${d.signerTitle ? ` · ${d.signerTitle}` : ''} <${d.signerEmail}> approved it on ${d.signedAt}.`),
      rows([
        { label: 'Typed signature', value: d.typedName },
        { label: 'Total', value: d.totalLabel },
        { label: 'IP address', value: d.ipAddress ?? 'not recorded' },
        { label: 'Content hash', value: d.contentHash, small: true },
        { label: 'Deposit due', value: d.depositLabel, strong: true },
      ]),
      button(d.adminUrl, 'Open in admin'),
    ].join('\n'),
  });
}

export interface DeclineEmailData {
  proposalTitle: string;
  declinedBy: string | null;
  declinerEmail: string | null;
  reason: string;
  declinedAt: string;
  totalLabel: string;
  proposalUrl: string;
  adminUrl: string;
  ipAddress: string | null;
}

/**
 * Sent to Lauren. A decline is the message she most needs to see quickly,
 * and the reason is the whole point of it — so the reason leads.
 */
function declineNotification(d: DeclineEmailData) {
  return brandEmail({
    title: `Declined: ${d.proposalTitle}`,
    eyebrow: 'Proposal declined',
    heading: d.proposalTitle,
    body: [
      paragraph(`${d.declinedBy ?? 'The client'} declined on ${d.declinedAt}.`),
      note(d.reason, 'Reason given'),
      rows([
        { label: 'Value', value: d.totalLabel },
        ...(d.declinerEmail ? [{ label: 'Email', value: d.declinerEmail }] : []),
        { label: 'IP address', value: d.ipAddress ?? 'not recorded' },
      ]),
      paragraph('Revising and publishing again reopens the proposal on the same link.', { size: 13, color: BRAND.muted }),
      button(d.adminUrl, 'Open in admin'),
    ].join('\n'),
  });
}

/** A short acknowledgement, only if they left an address. */
function declineAcknowledgement(d: DeclineEmailData) {
  return brandEmail({
    title: `Thanks for letting us know — ${d.proposalTitle}`,
    heading: 'Thanks for letting us know',
    body: [
      paragraph(
        `We have noted that you are not moving ahead with <strong style="color:#000;">${esc(d.proposalTitle)}</strong>, and why. There is nothing else you need to do.`,
        { html: true },
      ),
      paragraph('If anything changes, or you would like a revised version, just reply to this email.'),
      links([{ href: d.proposalUrl, label: 'Read the proposal again' }]),
      signoff(),
    ].join('\n'),
  });
}

/**
 * A decline is best-effort mail like the signing emails: the decision is
 * already recorded before either of these is attempted.
 */
export async function sendDeclineEmails(data: DeclineEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  const notifyTo = process.env.CONTACT_NOTIFY_TO;

  if (!apiKey || !from) {
    console.warn('Decline emails skipped: RESEND_API_KEY or CONTACT_NOTIFY_FROM is not set');
    return;
  }

  const resend = new Resend(apiKey);

  const results = await Promise.allSettled([
    notifyTo
      ? resend.emails.send({
          from,
          to: notifyTo,
          subject: `Declined: ${data.proposalTitle}`,
          html: declineNotification(data),
          text: `${data.proposalTitle} was declined on ${data.declinedAt}${data.declinedBy ? ` by ${data.declinedBy}` : ''}.\n\nReason:\n${data.reason}\n\nValue ${data.totalLabel}\nIP ${data.ipAddress ?? 'not recorded'}\n\n${data.adminUrl}`,
        })
      : Promise.resolve(null),
    data.declinerEmail
      ? resend.emails.send({
          from,
          to: data.declinerEmail,
          subject: `Thanks for letting us know — ${data.proposalTitle}`,
          html: declineAcknowledgement(data),
          text: `Thanks for letting us know you are not moving ahead with ${data.proposalTitle}. No further action is needed.\n\nIf anything changes, reply to this email.\n\n${data.proposalUrl}`,
        })
      : Promise.resolve(null),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Decline email ${index === 0 ? 'to agency' : 'to client'} failed:`, result.reason);
    }
  });
}

export async function sendSigningEmails(data: SigningEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  const notifyTo = process.env.CONTACT_NOTIFY_TO;

  if (!apiKey || !from) {
    console.warn('Signing emails skipped: RESEND_API_KEY or CONTACT_NOTIFY_FROM is not set');
    return;
  }

  const resend = new Resend(apiKey);

  const results = await Promise.allSettled([
    resend.emails.send({
      from,
      to: data.signerEmail,
      subject: `Approved — ${data.proposalTitle}`,
      html: clientReceipt(data),
      text: `You approved ${data.proposalTitle} on ${data.signedAt}.\n\nTotal ${data.totalLabel}\nDeposit due (${data.depositPercent}%) ${data.depositLabel}\n\nPay the deposit: ${data.portalUrl}\nRead the proposal: ${data.proposalUrl}`,
      // A signed proposal is a document the client should be able to keep
      // without depending on a link staying live.
      ...(data.pdf
        ? { attachments: [{ filename: data.pdf.filename, content: data.pdf.content }] }
        : {}),
    }),
    notifyTo
      ? resend.emails.send({
          from,
          to: notifyTo,
          subject: `Signed: ${data.proposalTitle}`,
          html: agencyNotification(data),
          text: `${data.proposalTitle} was signed by ${data.signerName} <${data.signerEmail}> on ${data.signedAt}.\n\nTotal ${data.totalLabel}\nDeposit ${data.depositLabel}\nIP ${data.ipAddress ?? 'not recorded'}\nHash ${data.contentHash}\n\n${data.adminUrl}`,
        })
      : Promise.resolve(null),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Signing email ${index === 0 ? 'to client' : 'to agency'} failed:`, result.reason);
    }
  });
}
