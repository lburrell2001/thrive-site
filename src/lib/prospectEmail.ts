// A prospect email: outreach to one potential client, from a template.
//
// Two styles. "personal" reads like a note Lauren typed — plain text on
// white, no banner, a small signature with the logo — which is what gets
// replies and stays out of the Promotions tab. "designed" uses the
// newsletter block builder for a polished, image-led email.
//
// Pure: the editor and the send dialog preview with it, and the server
// sends with it, so the preview is the email.

import { parseArticle } from '@/lib/articleMarkdown';
import { esc, href, inlineHtml, inlineText, renderNewsletter } from '@/lib/newsletterEmail';
import { blockTexts, mapBlockText, newBlock, normalizeBlocks, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';
import { SITE_URL } from '@/lib/seo';

export type ProspectStyle = 'personal' | 'designed';

export interface ProspectTemplate {
  id: string;
  name: string;
  style: ProspectStyle;
  subject: string;
  preheader: string;
  body: string;
  blocks: NewsletterBlock[];
  design: Partial<NewsletterDesign>;
  created_at: string;
  updated_at: string;
}

/** What one email is made of: a template, after any edits for this person. */
export interface ProspectContent {
  style: ProspectStyle;
  subject: string;
  preheader: string;
  /** Personal: the whole message. */
  body: string;
  /** Designed: the layout, plus an optional note shown above it. */
  blocks: NewsletterBlock[];
  design: Partial<NewsletterDesign>;
  note?: string;
}

export interface ProspectRecipient {
  firstName: string | null;
  company: string | null;
}

export interface ProspectRenderOptions extends ProspectRecipient {
  site: string;
  unsubscribeUrl: string;
  postalAddress: string;
}

export const SENDER_NAME = 'Lauren Burrell';

/** Who template previews and tests are addressed to. */
export const SAMPLE_CONTACT = { firstName: 'Maya', company: 'Bloom Bakery' };
export const PROSPECT_REASON = "You're getting this because I thought Thrive Creative Studios could help your business. Not interested? Unsubscribe below and I won't email again.";

// ---------------------------------------------------------- merge fields

export const MERGE_FIELDS = [
  { token: '{{first_name}}', label: 'First name', fallback: 'there' },
  { token: '{{company}}', label: 'Company', fallback: 'your business' },
] as const;

/** Fill {{first_name}} and {{company}}, with a friendly fallback for blanks. */
export function fillFields(text: string, r: ProspectRecipient) {
  return (text ?? '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, r.firstName?.trim() || 'there')
    .replace(/\{\{\s*company\s*\}\}/gi, r.company?.trim() || 'your business');
}

/**
 * [[Fill-me-in]] spots a template leaves for the line written for each
 * person. Sending is refused while any remain.
 */
const PLACEHOLDER = /\[\[[^\]]*\]\]/g;

export function placeholdersIn(c: Pick<ProspectContent, 'style' | 'subject' | 'preheader' | 'body' | 'blocks' | 'note'>): string[] {
  const parts = [c.subject, c.preheader, c.note ?? ''];
  if (c.style === 'personal') parts.push(c.body);
  else for (const b of normalizeBlocks(c.blocks)) parts.push(...blockTexts(b));
  return parts.flatMap((t) => t.match(PLACEHOLDER) ?? []);
}

function fillBlock(b: NewsletterBlock, r: ProspectRecipient): NewsletterBlock {
  return mapBlockText(b, (t) => fillFields(t, r));
}

// --------------------------------------------------------------- render

export function renderProspect(c: ProspectContent, opts: ProspectRenderOptions) {
  const r = { firstName: opts.firstName, company: opts.company };
  const subject = fillFields(c.subject, r);
  const preheader = fillFields(c.preheader, r);

  if (c.style === 'designed') {
    const note = c.note?.trim();
    const layout = normalizeBlocks(c.blocks);
    // The note reads as the start of the letter: under the greeting, after any logo bar.
    const at = layout[0]?.type === 'header' ? 1 : 0;
    if (note) layout.splice(at, 0, { ...newBlock('text'), text: note, pad: 'small' } as NewsletterBlock);
    const blocks = layout.map((b) => fillBlock(b, r));
    const { html, text } = renderNewsletter(
      { subject, preheader, body: '', blocks, design: c.design },
      { site: opts.site, unsubscribeUrl: opts.unsubscribeUrl, postalAddress: opts.postalAddress, firstName: opts.firstName, reason: PROSPECT_REASON },
    );
    return { subject, html, text };
  }

  return { subject, ...renderPersonal(fillFields(c.body, r), preheader, subject, opts) };
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const P = `margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:#1a1a1a;`;

/** Looks typed, not designed: text on white, then a short signature. */
function renderPersonal(body: string, preheader: string, subject: string, opts: ProspectRenderOptions) {
  const blocks = parseArticle(body);
  const html = blocks.map((b) => {
    switch (b.kind) {
      case 'ul':
      case 'ol':
        return `<${b.kind} style="margin:0 0 14px;padding-left:22px;">${b.items.map((i) => `<li style="${P}margin-bottom:4px;">${inlineHtml(i, opts.site)}</li>`).join('')}</${b.kind}>`;
      case 'img': {
        const src = href(b.src, opts.site);
        return src ? `<img src="${esc(src)}" alt="${esc(b.alt)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:8px;margin:4px 0 16px;" />` : '';
      }
      case 'h2':
      case 'h3':
        return `<p style="${P}font-weight:700;">${inlineHtml(b.text, opts.site)}</p>`;
      case 'quote':
        return `<p style="${P}padding-left:12px;border-left:3px solid #e40586;">${inlineHtml(b.text, opts.site)}</p>`;
      default:
        return `<p style="${P}">${inlineHtml(b.text, opts.site)}</p>`;
    }
  }).join('\n');

  const website = SITE_URL.replace(/^https?:\/\//, '');
  const signature = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>
<td valign="middle" style="padding-right:14px;border-right:2px solid #e40586;"><a href="${esc(SITE_URL)}"><img src="${SITE_URL}/email/logo-outline.png" alt="Thrive" width="96" style="display:block;width:96px;height:auto;border:0;" /></a></td>
<td valign="middle" style="padding-left:14px;font-family:${FONT};font-size:13px;line-height:1.5;color:#1a1a1a;">
<strong style="font-size:14px;">${SENDER_NAME}</strong><br>Thrive Creative Studios<br>
<a href="${esc(SITE_URL)}" style="color:#e40586;text-decoration:none;">${esc(website)}</a>
</td></tr></table>`;

  const doc = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td style="padding:24px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td>
${html}
${signature}
<p style="margin:36px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#8a8a8a;">
Not interested? <a href="${esc(opts.unsubscribeUrl)}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a> and I won't email again.<br>
Thrive Creative Studios · ${esc(opts.postalAddress)}
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    ...blocks.map((b) => {
      if ('items' in b) return b.items.map((i, j) => `${b.kind === 'ol' ? `${j + 1}.` : '-'} ${inlineText(i, opts.site)}`).join('\n');
      return 'text' in b ? inlineText(b.text, opts.site) : '';
    }),
    `${SENDER_NAME}\nThrive Creative Studios\n${website}`,
    '—',
    `Not interested? Unsubscribe: ${opts.unsubscribeUrl}`,
    `Thrive Creative Studios · ${opts.postalAddress}`,
  ].filter(Boolean).join('\n\n');

  return { html: doc, text };
}

// -------------------------------------------------------------- starters

/** The first templates, so there's something good to start from. */
export function starterTemplates(): Pick<ProspectTemplate, 'name' | 'style' | 'subject' | 'preheader' | 'body' | 'blocks'>[] {
  return [
    {
      name: 'Personal intro',
      style: 'personal',
      subject: 'Quick idea for {{company}}',
      preheader: '',
      body: [
        'Hi {{first_name}},',
        '',
        "I'm Lauren, the designer behind Thrive Creative Studios. [[One specific thing you noticed about their business, website or Instagram — this line is what gets replies.]]",
        '',
        'I help small businesses look as good as the work they do: brand identities, websites that turn visitors into calls, and social content that stays consistent. You can see some recent work [in my portfolio](/portfolio).',
        '',
        "If a refresh is anywhere on your list this year, would you be open to a 15-minute call? You can [pick a time here](/book), or just reply to this email.",
        '',
        'Thanks,',
      ].join('\n'),
      blocks: [],
    },
    {
      name: 'Follow-up',
      style: 'personal',
      subject: 'Re: Quick idea for {{company}}',
      preheader: '',
      body: [
        'Hi {{first_name}},',
        '',
        "Following up on my note last week — I know inboxes get busy. [[A short, useful idea for them: one thing you'd change on their site or brand.]]",
        '',
        "If now isn't the right time, no problem at all. If it is, [grab 15 minutes here](/book) or reply and I'll send a couple of times.",
        '',
        'Thanks,',
      ].join('\n'),
      blocks: [],
    },
    {
      name: 'Designed intro',
      style: 'designed',
      subject: 'Brand and web design for {{company}}',
      preheader: 'Recent work from Thrive Creative Studios, and a 15-minute call if it helps.',
      body: '',
      blocks: [
        newBlock('header'),
        {
          ...newBlock('hero'),
          eyebrow: 'Thrive Creative Studios',
          headline: 'Brands and websites that bring in business',
          text: 'I design identities, websites and social content for small businesses — work that looks considered and makes it easy for customers to say yes.',
          buttonLabel: 'See recent work',
          buttonHref: '/portfolio',
          imagePosition: 'none',
        } as NewsletterBlock,
        { ...newBlock('gallery'), eyebrow: 'Recent work', heading: 'Fresh off the desk' } as NewsletterBlock,
        newBlock('features'),
        { ...newBlock('cta'), headline: 'Is {{company}} due a refresh?', text: "Fifteen minutes, no pressure — or just reply to this email." } as NewsletterBlock,
        newBlock('footer'),
      ],
    },
  ];
}
