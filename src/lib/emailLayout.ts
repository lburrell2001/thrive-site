// The Thrive look for one-to-one email: reminders, portal updates, proposal
// receipts, bookings. Newsletters have their own designer (newsletterEmail.ts).
//
// Email clients are not browsers: layout is tables, every style is inline,
// and web fonts only load in some clients (Apple Mail, iOS) — the others fall
// back to the stacks below, which keep the same weight and shape.
//
// Pure — no server-only imports — so it can be rendered for previews.

import { SITE_URL } from '@/lib/seo';

export const BRAND = {
  magenta: '#d12e83',
  orange: '#ea6b2c',
  blue: '#3b43af',
  mint: '#71f082',
  purple: '#861dc5',
  ink: '#000000',
  body: '#2b2b2b',
  muted: '#6b6b6b',
  rule: '#e6e1da',
  page: '#fffaf0',
  tint: '#fff7fb',
};

const HEADING = "'Bungee', 'Arial Black', Impact, sans-serif";
const BODY = "'Bai Jamjuree', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const LOGO_URL = `${SITE_URL}/new-thrive/logo.png`;

export function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------ building blocks
// Each returns an HTML fragment for the card body. Text arguments are escaped
// here; `html` arguments are trusted fragments built from these helpers.

export function paragraph(text: string, opts: { size?: number; color?: string; html?: boolean } = {}): string {
  const content = opts.html ? text : esc(text);
  return `<p style="margin:0 0 16px;font-family:${BODY};font-size:${opts.size ?? 15}px;line-height:1.6;color:${opts.color ?? BRAND.body};white-space:pre-line;">${content}</p>`;
}

export function greeting(firstName: string): string {
  return `<p style="margin:0 0 12px;font-family:${BODY};font-size:16px;line-height:1.5;font-weight:700;color:${BRAND.ink};">Hi ${esc(firstName)},</p>`;
}

/** A tinted panel for the facts of the message — amounts, dates, steps. */
export function panel(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
<tr><td style="background:${BRAND.page};border:1px solid ${BRAND.rule};border-radius:12px;padding:14px 18px;font-family:${BODY};font-size:14px;line-height:1.7;color:${BRAND.ink};white-space:pre-line;">${esc(text)}</td></tr>
</table>`;
}

/** Label / value rows, e.g. a receipt. The last row can be emphasised. */
export function rows(items: { label: string; value: string; href?: string; strong?: boolean; small?: boolean }[]): string {
  const body = items
    .map((r, i) => {
      const last = i === items.length - 1;
      const border = r.strong
        ? `border-top:2px solid ${BRAND.ink};`
        : last
          ? ''
          : `border-bottom:1px solid ${BRAND.rule};`;
      const valueStyle = r.strong
        ? `font-size:17px;font-weight:700;color:${BRAND.magenta};`
        : r.small
          ? `font-size:11px;color:${BRAND.muted};word-break:break-all;`
          : `font-size:14px;color:${BRAND.ink};`;
      return `<tr>
<td style="${border}padding:10px 0;font-family:${BODY};font-size:13px;color:${BRAND.muted};vertical-align:top;">${esc(r.label)}</td>
<td style="${border}padding:10px 0 10px 16px;font-family:${BODY};${valueStyle}text-align:right;vertical-align:top;">${r.href ? `<a href="${esc(r.href)}" style="color:inherit;text-decoration:underline;text-decoration-color:${BRAND.magenta};">${esc(r.value)}</a>` : esc(r.value)}</td>
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-collapse:collapse;">${body}</table>`;
}

/** A titled list of lines, each optionally a link; `late` lines are flagged red. */
export function section(title: string, lines: { text: string; href?: string; tone?: 'late' }[]): string {
  const items = lines
    .map((l) => {
      const color = l.tone === 'late' ? '#b3261e' : BRAND.ink;
      const text = l.href
        ? `<a href="${esc(l.href)}" style="color:${color};text-decoration:none;">${esc(l.text)}</a>`
        : esc(l.text);
      return `<tr><td style="padding:8px 0;border-top:1px solid ${BRAND.rule};font-family:${BODY};font-size:14px;line-height:1.5;color:${color};">${text}</td></tr>`;
    })
    .join('');
  return `<p style="margin:22px 0 4px;font-family:${BODY};font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:${BRAND.magenta};">${esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${items}</table>`;
}

/** A personal line from Lauren, set apart from the system text. */
export function note(text: string, label?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
<tr><td style="border-left:4px solid ${BRAND.magenta};background:${BRAND.tint};padding:12px 16px;font-family:${BODY};font-size:15px;line-height:1.6;color:${BRAND.ink};white-space:pre-line;">${label ? `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:${BRAND.magenta};margin-bottom:4px;">${esc(label)}</div>` : ''}${esc(text)}</td></tr>
</table>`;
}

/** A pill button that survives Outlook (the table cell carries the colour). */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
<tr><td align="center" bgcolor="${BRAND.magenta}" style="border-radius:999px;background:${BRAND.magenta};">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${BODY};font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr>
</table>`;
}

/** Small inline links under a button, e.g. "Read the proposal · Save a PDF". */
export function links(items: { href: string; label: string }[]): string {
  const inner = items
    .map((l) => `<a href="${esc(l.href)}" style="color:${BRAND.ink};text-decoration:underline;text-decoration-color:${BRAND.magenta};">${esc(l.label)}</a>`)
    .join(`<span style="color:${BRAND.muted};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`);
  return `<p style="margin:14px 0 0;font-family:${BODY};font-size:14px;line-height:1.6;">${inner}</p>`;
}

export function signoff(): string {
  return `<p style="margin:26px 0 0;font-family:${BODY};font-size:15px;line-height:1.5;color:${BRAND.ink};">Talk soon,<br><strong>Lauren</strong><br><span style="font-size:13px;color:${BRAND.muted};">Thrive Creative Studios</span></p>`;
}

// ------------------------------------------------------------------- the shell

export interface BrandEmail {
  /** The <title> and the inbox preview text. */
  title: string;
  preheader?: string;
  /** Small coloured line above the heading. */
  eyebrow?: string;
  /** Set in Bungee — keep it short. */
  heading: string;
  /** Card body, built from the helpers above. */
  body: string;
  /** Footer line under the card; defaults to the studio's address line. */
  footer?: string;
}

const STRIPE = [BRAND.mint, BRAND.purple, BRAND.blue, BRAND.magenta, BRAND.orange]
  .map((c) => `<td width="20%" height="8" style="height:8px;line-height:8px;font-size:1px;background:${c};" bgcolor="${c}">&nbsp;</td>`)
  .join('');

export function brandEmail(e: BrandEmail): string {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(e.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bai+Jamjuree:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light only; }
  @media (max-width: 620px) {
    .card-pad { padding: 26px 22px 28px !important; }
    .heading { font-size: 22px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%;">
${e.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(e.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};" bgcolor="${BRAND.page}"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;">

<tr><td style="padding:0 4px 20px;">
<a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" alt="Thrive" width="132" height="45" style="display:block;width:132px;height:auto;border:0;"></a>
</td></tr>

<tr><td style="background:#ffffff;border:2px solid ${BRAND.ink};border-radius:18px;overflow:hidden;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${STRIPE}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="card-pad" style="padding:32px 36px 34px;">
${e.eyebrow ? `<p style="margin:0 0 8px;font-family:${BODY};font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:${BRAND.magenta};">${esc(e.eyebrow)}</p>` : ''}
<h1 class="heading" style="margin:0 0 20px;font-family:${HEADING};font-size:26px;line-height:1.15;font-weight:400;color:${BRAND.ink};">${esc(e.heading)}</h1>
${e.body}
</td></tr></table>
</td></tr>

<tr><td style="padding:20px 4px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${BRAND.muted};">
${e.footer ?? `Thrive Creative Studios · Dallas, Texas<br><a href="${SITE_URL}" style="color:${BRAND.muted};text-decoration:underline;">${host}</a>`}
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}
