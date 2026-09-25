// A newsletter as an email: the same markdown as journal articles, turned
// into email-safe HTML (inline styles, tables for width, everything
// escaped) and a plain-text version.
//
// Every newsletter carries the unsubscribe link and the studio's postal
// address — both required by CAN-SPAM for marketing email.

import { parseArticle } from '@/lib/articleMarkdown';

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
}

export function renderNewsletter(
  n: NewsletterContent,
  opts: { site: string; unsubscribeUrl: string; postalAddress: string; firstName?: string | null },
) {
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
