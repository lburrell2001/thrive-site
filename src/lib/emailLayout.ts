// The Thrive look for every email except newsletters (newsletterEmail.ts has
// its own designer): a black band with the white logo, a white body in
// Bai Jamjuree with Bungee headings and buttons, and a black footer with the
// white logo mark — the same pieces as the site and the portal sign-in.
//
// Email clients are not browsers: layout is tables, every style is inline,
// images must be PNG (no SVG in Gmail/Outlook), and web fonts only load in
// some clients (Apple Mail, iOS) — the others fall back to the stacks below.
//
// Pure — no server-only imports — so it can be rendered for previews.

import { SITE_URL } from '@/lib/seo';

/** The logo's own colours (public/email/*.png), plus the neutrals. */
export const BRAND = {
  magenta: '#e50586',
  orange: '#fd6100',
  blue: '#3943b7',
  green: '#0cf574',
  purple: '#9409ce',
  black: '#0a0a0a',
  ink: '#0a0a0a',
  body: '#2b2b2b',
  muted: '#6b6b6b',
  rule: '#e7e5e1',
  soft: '#f5f4f1',
};

export type Accent = 'magenta' | 'orange' | 'blue' | 'green' | 'purple';

/** Text colour that reads on each accent, as on the site's nav buttons. */
const ON_ACCENT: Record<Accent, string> = {
  magenta: '#ffffff',
  purple: '#ffffff',
  blue: '#ffffff',
  green: BRAND.black,
  orange: BRAND.black,
};

const HEADING = "'Bungee', 'Arial Black', Impact, sans-serif";
const BODY = "'Bai Jamjuree', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const LOGO_URL = `${SITE_URL}/email/logo-white.png`;
const MARK_URL = `${SITE_URL}/email/mark-white.png`;

export function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------ building blocks
// Each returns an HTML fragment for the body. Text arguments are escaped
// here; `html` arguments are trusted fragments built from these helpers.

export function paragraph(text: string, opts: { size?: number; color?: string; html?: boolean } = {}): string {
  const content = opts.html ? text : esc(text);
  return `<p style="margin:0 0 16px;font-family:${BODY};font-size:${opts.size ?? 15}px;line-height:1.6;color:${opts.color ?? BRAND.body};white-space:pre-line;">${content}</p>`;
}

export function greeting(firstName: string): string {
  return `<p style="margin:0 0 12px;font-family:${BODY};font-size:16px;line-height:1.5;font-weight:700;color:${BRAND.ink};">Hi ${esc(firstName)},</p>`;
}

/** A grey panel for the facts of the message — amounts, dates, steps. */
export function panel(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
<tr><td style="background:${BRAND.soft};border-radius:10px;padding:16px 18px;font-family:${BODY};font-size:14px;line-height:1.7;color:${BRAND.ink};white-space:pre-line;" bgcolor="${BRAND.soft}">${esc(text)}</td></tr>
</table>`;
}

/** Label / value rows, e.g. a receipt. A `strong` row is the total. */
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
        ? `font-family:${HEADING};text-transform:uppercase;font-size:18px;color:${BRAND.magenta};`
        : r.small
          ? `font-family:${BODY};font-size:11px;color:${BRAND.muted};word-break:break-all;`
          : `font-family:${BODY};font-size:14px;color:${BRAND.ink};`;
      const value = r.href
        ? `<a href="${esc(r.href)}" style="color:inherit;text-decoration:underline;text-decoration-color:${BRAND.magenta};">${esc(r.value)}</a>`
        : esc(r.value);
      return `<tr>
<td style="${border}padding:11px 0;font-family:${BODY};font-size:13px;color:${BRAND.muted};vertical-align:top;">${esc(r.label)}</td>
<td style="${border}padding:11px 0 11px 16px;${valueStyle}text-align:right;vertical-align:top;">${value}</td>
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-collapse:collapse;">${body}</table>`;
}

/** A titled list of lines, each optionally a link; `late` lines are flagged red. */
export function section(title: string, lines: { text: string; href?: string; tone?: 'late' }[]): string {
  const items = lines
    .map((l) => {
      const color = l.tone === 'late' ? '#c4132a' : BRAND.ink;
      const text = l.href
        ? `<a href="${esc(l.href)}" style="color:${color};text-decoration:none;">${esc(l.text)}</a>`
        : esc(l.text);
      return `<tr><td style="padding:9px 0;border-top:1px solid ${BRAND.rule};font-family:${BODY};font-size:14px;line-height:1.5;color:${color};">${text}</td></tr>`;
    })
    .join('');
  return `<p style="margin:24px 0 6px;font-family:${HEADING};text-transform:uppercase;font-size:13px;letter-spacing:.02em;color:${BRAND.ink};">${esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${items}</table>`;
}

/** A personal line from Lauren, set apart from the system text. */
export function note(text: string, label?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
<tr><td style="border-left:4px solid ${BRAND.magenta};background:${BRAND.soft};padding:14px 18px;font-family:${BODY};font-size:15px;line-height:1.6;color:${BRAND.ink};white-space:pre-line;" bgcolor="${BRAND.soft}">${label ? `<div style="font-family:${HEADING};text-transform:uppercase;font-size:11px;letter-spacing:.04em;color:${BRAND.magenta};margin-bottom:6px;">${esc(label)}</div>` : ''}${esc(text)}</td></tr>
</table>`;
}

/** A Bungee button like the site's — the table cell carries the colour for Outlook. */
export function button(href: string, label: string, accent: Accent = 'magenta'): string {
  const bg = BRAND[accent];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
<tr><td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};">
<a href="${esc(href)}" style="display:inline-block;padding:15px 26px;font-family:${HEADING};text-transform:uppercase;font-size:14px;letter-spacing:.03em;line-height:1;color:${ON_ACCENT[accent]};text-decoration:none;border-radius:10px;">${esc(label)}&nbsp;&rarr;</a>
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
  return `<p style="margin:28px 0 0;font-family:${BODY};font-size:15px;line-height:1.5;color:${BRAND.ink};">Talk soon,<br><strong>Lauren</strong><br><span style="font-size:13px;color:${BRAND.muted};">Thrive Creative Studios</span></p>`;
}

// ------------------------------------------------------------------- the shell

export interface BrandEmail {
  /** The <title> and the inbox preview text. */
  title: string;
  preheader?: string;
  /** A coloured tag above the heading, like the site's nav buttons. */
  eyebrow?: string;
  /** Colour of the eyebrow tag. */
  accent?: Accent;
  /** Set in Bungee — keep it short. */
  heading: string;
  /** Body, built from the helpers above. */
  body: string;
}

export function brandEmail(e: BrandEmail): string {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  const accent = e.accent ?? 'magenta';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(e.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bai+Jamjuree:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light only; }
  @media (max-width: 620px) {
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .heading { font-size: 24px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;">
${e.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(e.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;" bgcolor="#ffffff"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;">

<tr><td class="pad" bgcolor="${BRAND.black}" style="background:${BRAND.black};border-radius:16px 16px 0 0;padding:30px 40px 28px;">
<a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" alt="Thrive" width="150" height="51" style="display:block;width:150px;height:auto;border:0;"></a>
</td></tr>
<tr><td height="4" bgcolor="${BRAND.magenta}" style="height:4px;line-height:4px;font-size:1px;background:${BRAND.magenta};">&nbsp;</td></tr>

<tr><td class="pad" bgcolor="#ffffff" style="background:#ffffff;border-left:1px solid ${BRAND.rule};border-right:1px solid ${BRAND.rule};padding:34px 40px 38px;">
${e.eyebrow ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td bgcolor="${BRAND[accent]}" style="background:${BRAND[accent]};border-radius:7px;padding:7px 12px;font-family:${HEADING};text-transform:uppercase;font-size:11px;letter-spacing:.04em;line-height:1;color:${ON_ACCENT[accent]};">${esc(e.eyebrow)}</td></tr></table>` : ''}
<h1 class="heading" style="margin:0 0 22px;font-family:${HEADING};text-transform:uppercase;font-size:28px;line-height:1.12;font-weight:400;color:${BRAND.ink};">${esc(e.heading)}</h1>
${e.body}
</td></tr>

<tr><td height="4" bgcolor="${BRAND.magenta}" style="height:4px;line-height:4px;font-size:1px;background:${BRAND.magenta};">&nbsp;</td></tr>
<tr><td class="pad" bgcolor="${BRAND.black}" style="background:${BRAND.black};border-radius:0 0 16px 16px;padding:24px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:16px;vertical-align:middle;"><img src="${MARK_URL}" alt="" width="22" height="38" style="display:block;width:22px;height:auto;border:0;"></td>
<td style="vertical-align:middle;font-family:${HEADING};text-transform:uppercase;font-size:11px;letter-spacing:.04em;line-height:1.7;color:#ffffff;">Thrive Creative Studios <span style="color:${BRAND.magenta};">&#10022;</span> Dallas, TX<br>
<a href="${SITE_URL}" style="font-family:${BODY};font-size:12px;letter-spacing:0;text-transform:none;color:#a3a3a3;text-decoration:none;">${host}</a></td>
</tr></table>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}
