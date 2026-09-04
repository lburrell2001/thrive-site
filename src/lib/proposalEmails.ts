// Signing emails: a receipt to the client, a notification to Lauren.
//
// Both are best-effort. A signature is recorded in the database before any
// mail is attempted, and a mail failure never fails the signing — the client
// has already agreed, and losing that because an SMTP call timed out would
// be the worse outcome. Failures are logged instead.

import 'server-only';
import { Resend } from 'resend';

function esc(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

const SHELL = (inner: string) => `
  <div style="margin:0;padding:0;background:#000;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:28px 22px;">
      <div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#ff5a1f;font-weight:700;">
        Thrive Creative Studios
      </div>
      ${inner}
      <div style="margin-top:26px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.5);font-size:11px;">
        Thrive Creative Studios
      </div>
    </div>
  </div>
`;

const BUTTON = (href: string, label: string) => `
  <a href="${esc(href)}" style="display:inline-block;background:#35e06b;color:#000;padding:12px 22px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;">
    ${esc(label)}
  </a>
`;

/** Sent to the client. Restates what they approved and what happens next. */
function clientReceipt(d: SigningEmailData) {
  return SHELL(`
    <h1 style="margin:10px 0 6px;color:#fff;font-size:24px;line-height:1.15;">Thank you — approved.</h1>
    <p style="color:rgba(255,255,255,.72);font-size:14px;line-height:1.6;margin:0 0 18px;">
      You approved <strong style="color:#fff;">${esc(d.proposalTitle)}</strong> on
      ${esc(d.signedAt)}. This email is your receipt — keep it for your records.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.62);font-size:13px;">Signed by</td>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14);color:#fff;font-size:13px;text-align:right;">${esc(d.typedName)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.62);font-size:13px;">Total</td>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14);color:#fff;font-size:13px;text-align:right;">${esc(d.totalLabel)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:2px solid #35e06b;color:rgba(255,255,255,.62);font-size:13px;">Deposit due (${d.depositPercent}%)</td>
        <td style="padding:9px 0;border-bottom:2px solid #35e06b;color:#35e06b;font-size:15px;font-weight:700;text-align:right;">${esc(d.depositLabel)}</td>
      </tr>
    </table>

    <p style="color:rgba(255,255,255,.72);font-size:14px;line-height:1.6;margin:0 0 16px;">
      Next step: pay the deposit in your client portal. Work begins as soon as it lands.
    </p>

    ${BUTTON(d.portalUrl, 'Pay the deposit')}

    <p style="margin:18px 0 0;font-size:13px;">
      <a href="${esc(d.proposalUrl)}" style="color:#35e06b;">Read the proposal again</a>
      &nbsp;·&nbsp;
      <a href="${esc(d.printUrl)}" style="color:#35e06b;">Save a PDF copy</a>
    </p>
    ${
      d.pdf
        ? ''
        : `<p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,.5);">A PDF copy is available at the link above.</p>`
    }
  `);
}

/** Sent to Lauren. Carries the audit detail, which the client's copy does not. */
function agencyNotification(d: SigningEmailData) {
  return SHELL(`
    <h1 style="margin:10px 0 6px;color:#fff;font-size:24px;line-height:1.15;">${esc(d.proposalTitle)} was signed.</h1>
    <p style="color:rgba(255,255,255,.72);font-size:14px;line-height:1.6;margin:0 0 18px;">
      ${esc(d.signerName)}${d.signerTitle ? ` · ${esc(d.signerTitle)}` : ''} &lt;${esc(d.signerEmail)}&gt;
      approved it on ${esc(d.signedAt)}.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:13px;">Typed signature</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;">${esc(d.typedName)}</td></tr>
      <tr><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:13px;">Total</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;">${esc(d.totalLabel)}</td></tr>
      <tr><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:13px;">Deposit due</td><td style="padding:7px 0;color:#35e06b;font-size:13px;font-weight:700;text-align:right;">${esc(d.depositLabel)}</td></tr>
      <tr><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:13px;">IP address</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;">${esc(d.ipAddress ?? 'not recorded')}</td></tr>
      <tr><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:13px;">Content hash</td><td style="padding:7px 0;color:rgba(255,255,255,.62);font-size:10px;text-align:right;word-break:break-all;">${esc(d.contentHash)}</td></tr>
    </table>

    ${BUTTON(d.adminUrl, 'Open in admin')}
  `);
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
