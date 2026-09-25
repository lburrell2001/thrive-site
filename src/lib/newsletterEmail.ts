// A newsletter as an email: the same markdown as journal articles, turned
// into email-safe HTML (inline styles, tables for width, everything
// escaped) and a plain-text version.
//
// Every newsletter carries the unsubscribe link and the studio's postal
// address — both required by CAN-SPAM for marketing email.

import { parseArticle } from '@/lib/articleMarkdown';
import { EMAIL_FONTS, resolveDesign, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Relative links become absolute; anything but http(s)/mailto is dropped. */
function href(url: string, site: string): string | null {
  const u = url.trim();
  if (u.startsWith('/')) return `${site}${u}`;
  return /^(https?:|mailto:)/i.test(u) ? u : null;
}

function inlineHtml(text: string, site: string) {
  return text.split(INLINE).filter(Boolean).map((t) => {
    if (t.startsWith('**') && t.endsWith('**')) return `<strong>${esc(t.slice(2, -2))}</strong>`;
    if (t.startsWith('*') && t.endsWith('*')) return `<em>${esc(t.slice(1, -1))}</em>`;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
    if (link) {
      const h = href(link[2], site);
      return h ? `<a href="${esc(h)}" style="color:#e40586;text-decoration:underline;">${esc(link[1])}</a>` : esc(link[1]);
    }
    return esc(t);
  }).join('');
}

function inlineText(text: string, site: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const h = href(url, site);
      return h ? `${label} (${h})` : label;
    });
}

const P = 'margin:0 0 16px;font-size:16px;line-height:1.65;color:#222;';

export interface NewsletterContent {
  subject: string;
  preheader: string;
  body: string;
  /** When present and non-empty, the email is built from these instead of `body`. */
  blocks?: NewsletterBlock[] | null;
  design?: Partial<NewsletterDesign> | null;
}

export interface RenderOptions {
  site: string;
  unsubscribeUrl: string;
  postalAddress: string;
  firstName?: string | null;
}

export function renderNewsletter(n: NewsletterContent, opts: RenderOptions) {
  return n.blocks && n.blocks.length ? renderBlocks(n, n.blocks, opts) : renderMarkdown(n, opts);
}

// ---------------------------------------------------------- designed

/** Paragraphs, lists and inline formatting inside a text block. */
function richText(source: string, site: string, style: string) {
  return parseArticle(source).map((b) => {
    if ('items' in b) {
      const tag = b.kind === 'ol' ? 'ol' : 'ul';
      return `<${tag} style="margin:0 0 14px;padding-left:22px;">${b.items.map((i) => `<li style="${style}margin:0 0 6px;">${inlineHtml(i, site)}</li>`).join('')}</${tag}>`;
    }
    if (!('text' in b)) return '';
    return `<p style="${style}margin:0 0 14px;">${inlineHtml(b.text, site)}</p>`;
  }).join('');
}

function button(label: string, link: string | null, d: NewsletterDesign, alignment: 'left' | 'center', fonts: { body: string }) {
  if (!link || !label.trim()) return '';
  // A padded table cell with a link inside: clickable across the whole
  // button in every client, Outlook included.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${alignment}" style="margin:${alignment === 'center' ? '0 auto' : '0'};">
<tr><td bgcolor="${d.accent}" style="border-radius:999px;background:${d.accent};">
<a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-family:${fonts.body};font-size:15px;font-weight:700;color:${d.buttonText};text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

function image(src: string, alt: string, link: string | null, width: number, radius: number) {
  if (!src) return '';
  const img = `<img src="${esc(src)}" alt="${esc(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${radius}px;" />`;
  return link ? `<a href="${esc(link)}" style="text-decoration:none;">${img}</a>` : img;
}

function socialRow(d: NewsletterDesign, site: string, fonts: { body: string }) {
  const links = [
    d.instagram && ['Instagram', d.instagram],
    d.linkedin && ['LinkedIn', d.linkedin],
    d.website && ['Website', d.website],
  ].filter(Boolean) as [string, string][];
  if (!links.length) return '';
  return links
    .map(([label, u]) => {
      const h = href(u, site);
      return h ? `<a href="${esc(h)}" style="font-family:${fonts.body};font-size:14px;font-weight:700;color:${d.accent};text-decoration:none;margin:0 10px;">${label}</a>` : '';
    })
    .join('');
}

function renderBlocks(n: NewsletterContent, blocks: NewsletterBlock[], opts: RenderOptions) {
  const d = resolveDesign(n.design);
  const fonts = { heading: EMAIL_FONTS[d.headingFont].stack, body: EMAIL_FONTS[d.bodyFont].stack };
  const googleFamilies = [...new Set([EMAIL_FONTS[d.headingFont].google, EMAIL_FONTS[d.bodyFont].google].filter(Boolean))];
  const bodyStyle = `font-family:${fonts.body};font-size:16px;line-height:1.65;color:${d.textColor};`;
  const pad = 'padding:0 32px;';
  const W = 600;

  const rows = blocks.map((b) => {
    switch (b.type) {
      case 'image': {
        const html = image(b.src, b.alt, b.href ? href(b.href, opts.site) : null, b.width === 'full' ? W : W - 64, b.width === 'full' ? 0 : 10);
        return html ? `<tr><td style="${b.width === 'full' ? 'padding:0;' : `${pad}padding-bottom:18px;`}">${html}</td></tr>` : '';
      }
      case 'heading':
        return `<tr><td style="${pad}padding-top:26px;padding-bottom:10px;text-align:${b.align};">
<h${b.size === 'large' ? 1 : 2} style="margin:0;font-family:${fonts.heading};font-size:${b.size === 'large' ? 30 : 22}px;line-height:1.15;color:${d.headingColor};font-weight:${d.headingFont === 'bungee' ? 400 : 700};">${esc(b.text)}</h${b.size === 'large' ? 1 : 2}>
</td></tr>`;
      case 'text':
        return `<tr><td style="${pad}padding-top:6px;text-align:${b.align};">${richText(b.text, opts.site, bodyStyle.replace('color:', `text-align:${b.align};color:`))}</td></tr>`;
      case 'button':
        return `<tr><td style="${pad}padding-top:8px;padding-bottom:22px;">${button(b.label, href(b.href, opts.site), d, b.align, fonts)}</td></tr>`;
      case 'columns': {
        const img = `<td class="stack" width="50%" valign="top" style="padding:12px 12px 12px ${b.imageSide === 'left' ? 32 : 12}px;">${image(b.image.src, b.image.alt, b.image.href ? href(b.image.href, opts.site) : null, 256, 10)}</td>`;
        const copy = `<td class="stack" width="50%" valign="top" style="padding:12px ${b.imageSide === 'left' ? 32 : 12}px 12px 12px;">
${b.heading ? `<h3 style="margin:0 0 8px;font-family:${fonts.heading};font-size:19px;line-height:1.2;color:${d.headingColor};font-weight:${d.headingFont === 'bungee' ? 400 : 700};">${esc(b.heading)}</h3>` : ''}
${richText(b.text, opts.site, bodyStyle.replace('font-size:16px', 'font-size:15px'))}
${button(b.buttonLabel, b.buttonHref ? href(b.buttonHref, opts.site) : null, d, 'left', fonts)}
</td>`;
        return `<tr><td style="padding:8px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${b.imageSide === 'left' ? img + copy : copy + img}</tr></table></td></tr>`;
      }
      case 'divider':
        return `<tr><td style="${pad}padding-top:14px;padding-bottom:14px;"><div style="height:1px;line-height:1px;background:#e8e5e2;">&nbsp;</div></td></tr>`;
      case 'spacer':
        return `<tr><td style="height:${{ small: 12, medium: 28, large: 52 }[b.size]}px;line-height:1px;font-size:1px;">&nbsp;</td></tr>`;
      case 'social': {
        const row = socialRow(d, opts.site, fonts);
        return row ? `<tr><td style="padding:18px 32px;text-align:center;">${row}</td></tr>` : '';
      }
    }
  }).join('\n');

  const logo = d.logoUrl
    ? `<tr><td style="padding:0 8px 16px;text-align:center;"><img src="${esc(d.logoUrl)}" alt="Thrive Creative Studios" width="160" style="display:inline-block;width:160px;max-width:160px;height:auto;border:0;" /></td></tr>`
    : `<tr><td style="padding:0 8px 14px;font-family:${fonts.heading};font-size:13px;letter-spacing:.08em;color:${d.accent};">THRIVE CREATIVE STUDIOS</td></tr>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(n.subject)}</title>
${googleFamilies.length ? `<link href="https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${f}`).join('&')}&display=swap" rel="stylesheet">` : ''}
<style>
  @media (max-width: 620px) {
    .stack { display: block !important; width: 100% !important; box-sizing: border-box; padding: 10px 24px !important; }
    .content { border-radius: 0 !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${d.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(n.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${d.pageBg};"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" width="${W}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${W}px;">
${logo}
<tr><td class="content" style="background:${d.contentBg};border-radius:14px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${opts.firstName ? `<tr><td style="${pad}padding-top:26px;"><p style="${bodyStyle}margin:0;">Hi ${esc(opts.firstName)},</p></td></tr>` : ''}
${rows}
<tr><td style="height:18px;line-height:1px;font-size:1px;">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 16px;font-family:${fonts.body};font-size:12px;line-height:1.6;color:#777;text-align:center;">
You're receiving this because you subscribed to updates from Thrive Creative Studios.<br>
<a href="${esc(opts.unsubscribeUrl)}" style="color:#777;text-decoration:underline;">Unsubscribe</a><br>
${esc(opts.postalAddress)}
</td></tr>
</table></td></tr></table>
</body></html>`;

  const plain = (s2: string) => inlineText(s2, opts.site);
  const text = [
    opts.firstName ? `Hi ${opts.firstName},` : '',
    ...blocks.map((b) => {
      switch (b.type) {
        case 'heading': return b.text.toUpperCase();
        case 'text': return plain(b.text);
        case 'button': { const h = href(b.href, opts.site); return h ? `${b.label}: ${h}` : ''; }
        case 'image': { const h = b.href ? href(b.href, opts.site) : null; return h && b.alt ? `${b.alt}: ${h}` : ''; }
        case 'columns': {
          const h = b.buttonHref ? href(b.buttonHref, opts.site) : null;
          return [b.heading.toUpperCase(), plain(b.text), h && b.buttonLabel ? `${b.buttonLabel}: ${h}` : ''].filter(Boolean).join('\n\n');
        }
        case 'divider': return '—';
        default: return '';
      }
    }),
    '—',
    `Unsubscribe: ${opts.unsubscribeUrl}`,
    `Thrive Creative Studios · ${opts.postalAddress}`,
  ].filter(Boolean).join('\n\n');

  return { html, text };
}

// ------------------------------------------------------------ markdown

function renderMarkdown(n: NewsletterContent, opts: RenderOptions) {
  const blocks = parseArticle(n.body);
  const body = blocks.map((b) => {
    switch (b.kind) {
      case 'h2': return `<h2 style="margin:28px 0 10px;font-size:22px;line-height:1.25;color:#0a0a0a;">${inlineHtml(b.text, opts.site)}</h2>`;
      case 'h3': return `<h3 style="margin:22px 0 8px;font-size:18px;line-height:1.3;color:#0a0a0a;">${inlineHtml(b.text, opts.site)}</h3>`;
      case 'quote': return `<blockquote style="margin:20px 0;padding:2px 0 2px 16px;border-left:4px solid #e40586;font-size:18px;font-weight:600;color:#0a0a0a;">${inlineHtml(b.text, opts.site)}</blockquote>`;
      case 'ul':
      case 'ol': {
        const tag = b.kind;
        return `<${tag} style="margin:0 0 16px;padding-left:22px;">${b.items.map((i) => `<li style="${P}margin-bottom:6px;">${inlineHtml(i, opts.site)}</li>`).join('')}</${tag}>`;
      }
      case 'img': {
        const src = href(b.src, opts.site);
        return src ? `<img src="${esc(src)}" alt="${esc(b.alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:10px;margin:8px 0 18px;" />` : '';
      }
      default: return `<p style="${P}">${inlineHtml(b.text, opts.site)}</p>`;
    }
  }).join('\n');

  const greeting = opts.firstName ? `<p style="${P}">Hi ${esc(opts.firstName)},</p>` : '';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(n.subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(n.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f4;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 8px 14px;font-size:13px;font-weight:800;letter-spacing:.06em;color:#e40586;">THRIVE CREATIVE STUDIOS</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e4e1de;border-radius:14px;padding:28px 24px;">
${greeting}
${body}
</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.6;color:#777;">
You're receiving this because you subscribed to updates from Thrive Creative Studios.<br>
<a href="${esc(opts.unsubscribeUrl)}" style="color:#777;text-decoration:underline;">Unsubscribe</a> · <a href="${esc(opts.site)}" style="color:#777;text-decoration:underline;">thrivecreativestudios.org</a><br>
${esc(opts.postalAddress)}
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    opts.firstName ? `Hi ${opts.firstName},` : '',
    ...blocks.map((b) => {
      if ('items' in b) {
        return b.items.map((i, j) => `${b.kind === 'ol' ? `${j + 1}.` : '-'} ${inlineText(i, opts.site)}`).join('\n');
      }
      if (!('text' in b)) return '';
      if (b.kind === 'h2' || b.kind === 'h3') return inlineText(b.text, opts.site).toUpperCase();
      return inlineText(b.text, opts.site);
    }),
    '—',
    `Unsubscribe: ${opts.unsubscribeUrl}`,
    `Thrive Creative Studios · ${opts.postalAddress}`,
  ].filter(Boolean).join('\n\n');

  return { html, text };
}
