// A designed email: a stack of sections rendered as table-based HTML that
// holds up in Gmail, Apple Mail and Outlook, and stacks on phones.
//
// Each section paints its own background, and its text, link and button
// colours are chosen against that background (see toneFor), so a section
// can be black, magenta or white without anything becoming unreadable.
//
// With `editing` set, the same HTML is annotated for the designer canvas:
// data-block on each section, data-field on text that can be typed into,
// data-img on images that take a dropped file, and data-opt around
// optional parts, which the canvas shows (empty, with a placeholder) only
// on the selected section. Sent emails never carry these.

import { parseArticle } from '@/lib/articleMarkdown';
import { esc, href, inlineHtml, inlineText } from '@/lib/emailText';
import {
  EMAIL_FONTS,
  contrast,
  isDark,
  normalizeBlocks,
  resolveDesign,
  type ImagePart,
  type NewsletterBlock,
  type NewsletterDesign,
} from '@/lib/newsletterBlocks';

export interface SectionRenderInput {
  subject: string;
  preheader: string;
  blocks: NewsletterBlock[];
  design?: Partial<NewsletterDesign> | null;
}

export interface SectionRenderOptions {
  site: string;
  unsubscribeUrl: string;
  postalAddress: string;
  firstName?: string | null;
  reason: string;
  /** Annotate for the designer canvas (see the header comment). */
  editing?: boolean;
}

const W = 600;
const SIDE = 40;
const PAD: Record<NonNullable<NewsletterBlock['pad']>, number> = { none: 0, small: 16, medium: 36, large: 60 };

/** Spacing for blocks saved before spacing was a setting: what they had then. */
function padOf(b: NewsletterBlock): number {
  if (b.pad) return PAD[b.pad];
  switch (b.type) {
    case 'image':
    case 'spacer': return 0;
    case 'heading': return 13;
    case 'text': return 3;
    case 'button': return 8;
    case 'columns': return 8;
    case 'divider': return 14;
    case 'social': return 18;
    default: return 36;
  }
}

interface Tone {
  bg: string;
  heading: string;
  text: string;
  muted: string;
  accent: string;
  btnBg: string;
  btnText: string;
  rule: string;
  dark: boolean;
}

/** Colours that read on this section's background. */
function toneFor(bg: string, d: NewsletterDesign): Tone {
  const dark = isDark(bg);
  const pick = (c: string, min: number, light: string, onDark: string) => (contrast(c, bg) >= min ? c : dark ? onDark : light);
  // On a dark band, headings go white with the text, so the band reads as one piece.
  const heading = dark ? (contrast(d.headingColor, bg) >= 7 ? d.headingColor : '#ffffff') : pick(d.headingColor, 3, '#0a0a0a', '#ffffff');
  const text = pick(d.textColor, 4.5, '#2b2b2b', '#e6e6e6');
  const accent = pick(d.accent, 2.6, heading, '#ffffff');
  // A button the colour of its own band disappears: invert it instead.
  const btnBg = contrast(d.accent, bg) >= 1.8 ? d.accent : dark ? '#ffffff' : '#0a0a0a';
  const btnText = contrast(d.buttonText, btnBg) >= 4.5 ? d.buttonText : isDark(btnBg) ? '#ffffff' : '#0a0a0a';
  return {
    bg, heading, text, accent, btnBg, btnText, dark,
    muted: dark ? '#a8a8a8' : '#6b6b6b',
    rule: dark ? '#333333' : '#e7e5e1',
  };
}

export function renderSections(n: SectionRenderInput, opts: SectionRenderOptions) {
  const d = resolveDesign(n.design);
  const blocks = normalizeBlocks(n.blocks);
  const edit = Boolean(opts.editing);
  /** An optional part: in the canvas, hidden while empty unless its section is selected. */
  const opt = (h: string) => (edit && h ? `<div data-opt="">${h}</div>` : h);
  const fonts = { heading: EMAIL_FONTS[d.headingFont].stack, body: EMAIL_FONTS[d.bodyFont].stack };
  const googleFamilies = [...new Set([EMAIL_FONTS[d.headingFont].google, EMAIL_FONTS[d.bodyFont].google].filter(Boolean))];
  const headingWeight = d.headingFont === 'bungee' ? 400 : 800;
  const caps = d.uppercase ? 'text-transform:uppercase;' : '';
  const imgRadius = { square: 0, soft: 10, round: 20 }[d.corners];
  const btnRadius = { square: 0, soft: 8, round: 999 }[d.corners];
  const cardRadius = { square: 0, soft: 14, round: 26 }[d.corners];
  const link = (u: string) => (u ? href(u, opts.site) : null);

  // ---- edit-mode annotations (empty strings when sending)
  const field = (path: string, ph = '') => (edit ? ` data-field="${path}"${ph ? ` data-ph="${esc(ph)}"` : ''}` : '');
  const imgAttr = (path: string) => (edit ? ` data-img="${path}"` : '');
  /** Plain text: escaped, line breaks kept. */
  const plain = (s: string) => esc(s).replace(/\n/g, '<br>');

  // ---- pieces
  const eyebrow = (b: NewsletterBlock, t: Tone, value: string, path = 'eyebrow', alignment = 'left') => {
    if (!value && !edit) return '';
    return opt(`<p${field(path, 'Small label')} style="margin:0 0 14px;font-family:${fonts.body};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${t.accent};text-align:${alignment};">${plain(value)}</p>`);
  };

  const headline = (t: Tone, value: string, path: string, size: number, mobile: string, alignment = 'left', tag = 'h2') =>
    `<${tag}${field(path, 'Headline')} class="${mobile}" style="margin:0;font-family:${fonts.heading};font-size:${size}px;line-height:1.05;font-weight:${headingWeight};letter-spacing:${d.headingFont === 'bungee' ? '0' : '-.02em'};${caps}color:${t.heading};text-align:${alignment};">${plain(value)}</${tag}>`;

  const para = (b: NewsletterBlock, t: Tone, value: string, path: string, size = 16, alignment = 'left', ph = 'A sentence or two') => {
    if (!value && !edit) return '';
    return `<p${field(path, ph)} style="margin:0;font-family:${fonts.body};font-size:${size}px;line-height:1.6;color:${t.text};text-align:${alignment};">${plain(value)}</p>`;
  };

  const rich = (source: string, t: Tone, size = 16, alignment = 'left') =>
    parseArticle(source).map((blk) => {
      const style = `font-family:${fonts.body};font-size:${size}px;line-height:1.65;color:${t.text};text-align:${alignment};`;
      if ('items' in blk) {
        const tag = blk.kind === 'ol' ? 'ol' : 'ul';
        return `<${tag} style="margin:0 0 14px;padding-left:22px;">${blk.items.map((i) => `<li style="${style}margin:0 0 6px;">${inlineHtml(i, opts.site, t.accent)}</li>`).join('')}</${tag}>`;
      }
      if (!('text' in blk)) return '';
      return `<p style="${style}margin:0 0 14px;">${inlineHtml(blk.text, opts.site, t.accent)}</p>`;
    }).join('');

  const button = (b: NewsletterBlock, t: Tone, label: string, url: string, path: string, alignment = 'left', big = false) => {
    const h = link(url);
    if ((!h || !label.trim()) && !edit) return '';
    const padding = big ? '17px 34px' : '14px 28px';
    // A padded cell with a link inside: clickable across the whole button
    // in every client, Outlook included.
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${alignment === 'center' ? 'center' : 'left'}" style="margin:${alignment === 'center' ? '0 auto' : '0'};">
<tr><td bgcolor="${t.btnBg}" style="border-radius:${btnRadius}px;background:${t.btnBg};">
<a href="${esc(h ?? '#')}"${field(path, 'Button')} style="display:inline-block;padding:${padding};font-family:${fonts.body};font-size:${big ? 16 : 15}px;font-weight:700;letter-spacing:.02em;color:${t.btnText};text-decoration:none;border-radius:${btnRadius}px;">${plain(label)}</a>
</td></tr></table>`;
  };

  const image = (img: ImagePart, width: number, radius: number, path: string, ratio = 0.62) => {
    if (!img.src) {
      if (!edit) return '';
      return `<div${imgAttr(path)} style="width:100%;max-width:${width}px;height:${Math.round(width * ratio)}px;border-radius:${radius}px;background:repeating-linear-gradient(45deg,#ececec,#ececec 10px,#f5f5f5 10px,#f5f5f5 20px);border:2px dashed #c9c9c9;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:600 13px/1.4 system-ui,sans-serif;color:#7a7a7a;text-align:center;">Drop an image here<br>or click to upload</div>`;
    }
    const tag = `<img${imgAttr(path)} src="${esc(img.src)}" alt="${esc(img.alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${radius}px;" />`;
    const h = link(img.href);
    return h && !edit ? `<a href="${esc(h)}" style="text-decoration:none;">${tag}</a>` : tag;
  };

  const space = (px: number) => `<div style="height:${px}px;line-height:${px}px;font-size:1px;">&nbsp;</div>`;

  const socials = (t: Tone, alignment: 'left' | 'center') => {
    const items = [
      d.instagram && ['Instagram', d.instagram],
      d.linkedin && ['LinkedIn', d.linkedin],
      d.website && ['Website', d.website],
    ].filter(Boolean) as [string, string][];
    return items.map(([label, u]) => {
      const h = href(u, opts.site);
      return h ? `<a href="${esc(h)}" style="font-family:${fonts.body};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${t.heading};text-decoration:none;margin:${alignment === 'center' ? '0 10px' : '0 20px 0 0'};">${label}</a>` : '';
    }).join('');
  };

  const logoFor = (t: Tone) => d.logoUrl || `${opts.site}/email/${t.dark ? 'logo-white' : 'logo-outline'}.png`;

  // ---- sections
  function section(b: NewsletterBlock): string {
    const bg = b.bg || d.contentBg;
    const t = toneFor(bg, d);
    const pad = padOf(b);
    const inner = W - SIDE * 2;
    let side = SIDE;
    let body = '';

    switch (b.type) {
      case 'header': {
        const links = b.links.map((l, i) => {
          const h = link(l.href);
          return `<a href="${esc(h ?? '#')}"${field(`links.${i}.label`, 'Link')} style="font-family:${fonts.body};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${t.heading};text-decoration:none;margin-left:18px;">${plain(l.label)}</a>`;
        }).join('');
        body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><a href="${esc(opts.site)}"><img src="${esc(logoFor(t))}" alt="Thrive Creative Studios" width="118" style="display:block;width:118px;height:auto;border:0;" /></a></td>
<td valign="middle" align="right" style="text-align:right;white-space:nowrap;">${links}</td>
</tr></table>`;
        break;
      }
      case 'hero': {
        const img = b.imagePosition === 'none' ? '' : image(b.image, inner, imgRadius, 'image', 0.6);
        const words = [
          eyebrow(b, t, b.eyebrow, 'eyebrow', b.align),
          headline(t, b.headline, 'headline', 46, 'h-xl', b.align, 'h1'),
          b.text || edit ? opt(space(16) + para(b, t, b.text, 'text', 18, b.align)) : '',
          b.buttonLabel || edit ? opt(space(28) + button(b, t, b.buttonLabel, b.buttonHref, 'buttonLabel', b.align, true)) : '',
        ].join('');
        body = b.imagePosition === 'above' ? `${img}${img ? space(32) : ''}${words}` : `${words}${img ? space(36) + img : ''}`;
        break;
      }
      case 'gallery': {
        const gap = 16;
        const cols = b.columns;
        const cellW = Math.floor((inner - gap * (cols - 1)) / cols);
        const rows: string[] = [];
        for (let i = 0; i < b.items.length; i += cols) {
          const cells = b.items.slice(i, i + cols).map((it, k) => {
            const idx = i + k;
            const left = k === 0 ? 0 : gap / 2;
            const right = k === cols - 1 ? 0 : gap / 2;
            const showTitle = it.title || edit;
            const showCaption = it.caption || edit;
            return `<td class="stack" width="${cellW}" valign="top" style="padding:0 ${right}px 22px ${left}px;">
${image(it, cellW, imgRadius, `items.${idx}`, cols === 1 ? 0.6 : 0.78)}
${showTitle ? opt(`<p${field(`items.${idx}.title`, 'Project name')} style="margin:14px 0 0;font-family:${fonts.body};font-size:16px;line-height:1.35;font-weight:700;color:${t.heading};">${plain(it.title)}</p>`) : ''}
${showCaption ? opt(`<p${field(`items.${idx}.caption`, 'What it was')} style="margin:4px 0 0;font-family:${fonts.body};font-size:12px;line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:${t.muted};">${plain(it.caption)}</p>`) : ''}
</td>`;
          });
          while (cells.length < cols) cells.push(`<td class="stack" width="${cellW}"></td>`);
          rows.push(`<tr>${cells.join('')}</tr>`);
        }
        const head = b.heading || b.eyebrow || edit
          ? opt(`${eyebrow(b, t, b.eyebrow)}${b.heading || edit ? opt(headline(t, b.heading, 'heading', 30, 'h-l')) : ''}${space(26)}`)
          : '';
        body = `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>`;
        break;
      }
      case 'stats': {
        const n = b.items.length;
        const cells = b.items.map((it, i) => `<td width="${Math.floor(100 / n)}%" valign="top" style="padding:0 8px;text-align:center;${i ? `border-left:1px solid ${t.rule};` : ''}">
<p${field(`items.${i}.value`, '40+')} class="h-stat" style="margin:0;font-family:${fonts.heading};font-size:44px;line-height:1;font-weight:${headingWeight};color:${t.accent};">${plain(it.value)}</p>
<p${field(`items.${i}.label`, 'what it counts')} style="margin:10px 0 0;font-family:${fonts.body};font-size:13px;line-height:1.4;letter-spacing:.06em;text-transform:uppercase;color:${t.muted};">${plain(it.label)}</p>
</td>`).join('');
        body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
        break;
      }
      case 'features': {
        const head = `${eyebrow(b, t, b.eyebrow)}${b.heading || edit ? opt(headline(t, b.heading, 'heading', 30, 'h-l') + space(18)) : ''}`;
        const items = b.items.map((it, i) => `<tr><td valign="top" width="${b.numbered ? 64 : 0}" style="padding:20px 0;border-top:1px solid ${t.rule};${b.numbered ? '' : 'display:none;'}">
${b.numbered ? `<p style="margin:0;font-family:${fonts.heading};font-size:22px;line-height:1.2;font-weight:${headingWeight};color:${t.accent};">${String(i + 1).padStart(2, '0')}</p>` : ''}
</td><td valign="top" style="padding:20px 0;border-top:1px solid ${t.rule};">
<p${field(`items.${i}.title`, 'Service')} style="margin:0;font-family:${fonts.body};font-size:18px;line-height:1.3;font-weight:700;color:${t.heading};">${plain(it.title)}</p>
${it.text || edit ? opt(`<p${field(`items.${i}.text`, 'One line about it')} style="margin:6px 0 0;font-family:${fonts.body};font-size:15px;line-height:1.6;color:${t.text};">${plain(it.text)}</p>`) : ''}
</td></tr>`).join('');
        body = `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>`;
        break;
      }
      case 'quote': {
        const who = [b.name && `<strong style="color:${t.heading};"${field('name', 'Name')}>${plain(b.name)}</strong>`, b.role && `<span${field('role', 'Role, company')}>${plain(b.role)}</span>`];
        if (edit) {
          if (!b.name) who[0] = `<strong style="color:${t.heading};"${field('name', 'Name')}></strong>`;
          if (!b.role) who[1] = `<span${field('role', 'Role, company')}></span>`;
        }
        body = `<p style="margin:0 0 4px;font-family:${fonts.heading};font-size:72px;line-height:.8;font-weight:${headingWeight};color:${t.accent};">&ldquo;</p>
<p${field('text', 'What they said')} class="h-quote" style="margin:0;font-family:${fonts.body};font-size:24px;line-height:1.4;font-weight:600;color:${t.heading};">${plain(b.text)}</p>
${who.some(Boolean) ? opt(`${space(20)}<p style="margin:0;font-family:${fonts.body};font-size:14px;line-height:1.5;letter-spacing:.04em;color:${t.muted};">${who.filter(Boolean).join(' &nbsp;·&nbsp; ')}</p>`) : ''}`;
        break;
      }
      case 'cta':
        body = [
          headline(t, b.headline, 'headline', 38, 'h-l', b.align),
          b.text || edit ? opt(space(14) + para(b, t, b.text, 'text', 17, b.align)) : '',
          space(28),
          button(b, t, b.buttonLabel, b.buttonHref, 'buttonLabel', b.align, true),
        ].join('');
        break;
      case 'footer': {
        const mark = t.dark ? `${opts.site}/email/mark-white.png` : `${opts.site}/email/logo-outline.png`;
        body = `<div style="text-align:center;">
<a href="${esc(opts.site)}"><img src="${esc(mark)}" alt="Thrive" width="${t.dark ? 28 : 96}" style="display:inline-block;width:${t.dark ? 28 : 96}px;height:auto;border:0;" /></a>
${b.tagline || edit ? opt(`${space(16)}<p${field('tagline', 'A sign-off line')} style="margin:0;font-family:${fonts.body};font-size:14px;line-height:1.6;color:${t.muted};text-align:center;">${plain(b.tagline)}</p>`) : ''}
${space(18)}<div>${socials(t, 'center')}</div>
</div>`;
        break;
      }
      case 'image':
        if (b.width === 'full') side = 0;
        body = image(b, b.width === 'full' ? W : inner, b.width === 'full' ? 0 : imgRadius, '', 0.5);
        break;
      case 'heading':
        body = `${eyebrow(b, t, b.eyebrow, 'eyebrow', b.align)}${headline(t, b.text, 'text', b.size === 'large' ? 34 : 24, b.size === 'large' ? 'h-l' : '', b.align)}`;
        break;
      case 'text':
        body = `<div data-rich="text">${rich(b.text, t, 16, b.align)}</div>`;
        break;
      case 'button':
        body = button(b, t, b.label, b.href, 'label', b.align);
        break;
      case 'columns': {
        const half = Math.floor((inner - 24) / 2);
        const img = `<td class="stack" width="${half}" valign="top" style="padding:0 ${b.imageSide === 'left' ? 12 : 0}px 0 ${b.imageSide === 'left' ? 0 : 12}px;">${image(b.image, half, imgRadius, 'image', 0.8)}</td>`;
        const copy = `<td class="stack" width="${half}" valign="top" style="padding:0 ${b.imageSide === 'left' ? 0 : 12}px 0 ${b.imageSide === 'left' ? 12 : 0}px;">
${b.heading || edit ? opt(`<h3${field('heading', 'Heading')} style="margin:0 0 10px;font-family:${fonts.heading};font-size:20px;line-height:1.15;font-weight:${headingWeight};${caps}color:${t.heading};">${plain(b.heading)}</h3>`) : ''}
<div data-rich="text">${rich(b.text, t, 15)}</div>
${b.buttonLabel ? button(b, t, b.buttonLabel, b.buttonHref, 'buttonLabel') : ''}
</td>`;
        body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${b.imageSide === 'left' ? img + copy : copy + img}</tr></table>`;
        break;
      }
      case 'divider':
        body = `<div style="height:1px;line-height:1px;font-size:1px;background:${t.rule};">&nbsp;</div>`;
        break;
      case 'spacer':
        body = space({ small: 12, medium: 28, large: 52 }[b.size]);
        break;
      case 'social':
        body = `<div style="text-align:center;">${socials(t, 'center')}</div>`;
        break;
    }

    if (!body) return '';
    const attrs = edit ? ` data-block="${b.id}" data-type="${b.type}"` : '';
    return `<tr><td${attrs} class="${side ? 'sec' : ''}" bgcolor="${bg}" style="background:${bg};padding:${pad}px ${side}px;">${body}</td></tr>`;
  }

  // The greeting sits under a leading logo bar, not above it.
  const lead = blocks[0]?.type === 'header' ? 1 : 0;
  const greetTone = toneFor(blocks[lead]?.bg || d.contentBg, d);
  const greeting = opts.firstName
    ? `<tr><td class="sec" bgcolor="${greetTone.bg}" style="background:${greetTone.bg};padding:28px ${SIDE}px ${blocks[lead]?.pad === 'none' || blocks[lead]?.type === 'image' ? 24 : 0}px;"><p style="margin:0;font-family:${fonts.body};font-size:16px;line-height:1.5;color:${greetTone.text};">Hi ${esc(opts.firstName)},</p></td></tr>`
    : '';
  const rows = blocks.map(section);
  rows.splice(lead, 0, greeting);

  const hasHeader = blocks.some((b) => b.type === 'header');
  const top = hasHeader ? '' : d.logoUrl
    ? `<tr><td style="padding:0 8px 16px;text-align:center;"><img src="${esc(d.logoUrl)}" alt="Thrive Creative Studios" width="160" style="display:inline-block;width:160px;max-width:160px;height:auto;border:0;" /></td></tr>`
    : `<tr><td style="padding:0 8px 14px;font-family:${fonts.heading};font-size:13px;letter-spacing:.08em;color:${toneFor(d.pageBg, d).accent};">THRIVE CREATIVE STUDIOS</td></tr>`;
  const legalTone = toneFor(d.pageBg, d);

  const editCss = edit ? `
  body { cursor: default; }
  [data-block] { cursor: pointer; transition: box-shadow .12s; }
  [data-block]:hover { box-shadow: inset 0 0 0 2px rgba(57,67,183,.45); }
  [data-block][data-selected] { box-shadow: inset 0 0 0 3px #3943b7; }
  [data-field] { cursor: text; outline: none; border-radius: 3px; min-width: 1ch; }
  [data-field]:hover { background: rgba(57,67,183,.08); }
  [data-field]:focus { background: rgba(229,5,134,.08); box-shadow: 0 0 0 2px rgba(229,5,134,.45); }
  [data-field]:empty::before { content: attr(data-ph); opacity: .38; }
  [data-block]:not([data-selected]) [data-opt]:has([data-field]:empty),
  [data-block]:not([data-selected]) [data-field]:empty { display: none !important; }
  [data-img] { cursor: pointer; }
  [data-img].drop { outline: 3px solid #e50586; outline-offset: 2px; }
  a { cursor: inherit; }` : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(n.subject)}</title>
${googleFamilies.length ? `<link href="https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${f}`).join('&')}&display=swap" rel="stylesheet">` : ''}
<style>
  @media (max-width: 620px) {
    .outer { padding: 0 !important; }
    .email { border-radius: 0 !important; }
    .sec { padding-left: 22px !important; padding-right: 22px !important; }
    .stack { display: block !important; width: 100% !important; box-sizing: border-box; padding-left: 0 !important; padding-right: 0 !important; }
    .stack + .stack { padding-top: 18px !important; }
    .stack img, .stack [data-img] { max-width: 100% !important; width: 100% !important; }
    .h-xl { font-size: 34px !important; }
    .h-l { font-size: 27px !important; }
    .h-stat { font-size: 30px !important; }
    .h-quote { font-size: 20px !important; }
  }${editCss}
</style></head>
<body style="margin:0;padding:0;background:${d.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(n.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${d.pageBg}" style="background:${d.pageBg};"><tr><td class="outer" align="center" style="padding:28px 12px;">
<table role="presentation" width="${W}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${W}px;">
${top}
<tr><td>
<table role="presentation" class="email" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${d.contentBg}" style="background:${d.contentBg};border-radius:${cardRadius}px;overflow:hidden;">
${rows.join('\n')}
</table>
</td></tr>
<tr><td style="padding:22px 24px;font-family:${fonts.body};font-size:12px;line-height:1.6;color:${legalTone.muted};text-align:center;">
${esc(opts.reason)}<br>
<a href="${esc(opts.unsubscribeUrl)}" style="color:${legalTone.muted};text-decoration:underline;">Unsubscribe</a><br>
${esc(opts.postalAddress)}
</td></tr>
</table></td></tr></table>
</body></html>`;

  return { html, text: sectionsText(blocks, opts) };
}

/** The plain-text version: every section's words and links, in order. */
function sectionsText(blocks: NewsletterBlock[], opts: SectionRenderOptions) {
  const h = (u: string) => (u ? href(u, opts.site) : null);
  const cta = (label: string, u: string) => { const x = h(u); return x && label ? `${label}: ${x}` : ''; };
  const lines = (...xs: (string | null | false | undefined)[]) => xs.filter(Boolean).join('\n\n');
  const body = blocks.map((b) => {
    switch (b.type) {
      case 'header': return '';
      case 'hero': return lines(b.eyebrow.toUpperCase(), b.headline.toUpperCase(), b.text, cta(b.buttonLabel, b.buttonHref));
      case 'gallery': return lines(b.heading.toUpperCase(), ...b.items.map((it) => [it.title, it.caption, h(it.href)].filter(Boolean).join(' — ')));
      case 'stats': return b.items.map((it) => `${it.value} ${it.label}`).join(' · ');
      case 'features': return lines(b.heading.toUpperCase(), ...b.items.map((it, i) => `${b.numbered ? `${String(i + 1).padStart(2, '0')} ` : ''}${it.title}${it.text ? ` — ${it.text}` : ''}`));
      case 'quote': return lines(`“${b.text}”`, [b.name, b.role].filter(Boolean).join(', '));
      case 'cta': return lines(b.headline.toUpperCase(), b.text, cta(b.buttonLabel, b.buttonHref));
      case 'footer': return b.tagline;
      case 'heading': return b.text.toUpperCase();
      case 'text': return inlineText(b.text, opts.site);
      case 'button': return cta(b.label, b.href);
      case 'image': { const x = h(b.href); return x && b.alt ? `${b.alt}: ${x}` : ''; }
      case 'columns': return lines(b.heading.toUpperCase(), inlineText(b.text, opts.site), cta(b.buttonLabel, b.buttonHref));
      case 'divider': return '—';
      default: return '';
    }
  });
  return lines(
    opts.firstName ? `Hi ${opts.firstName},` : '',
    ...body,
    '—',
    `Unsubscribe: ${opts.unsubscribeUrl}`,
    `Thrive Creative Studios · ${opts.postalAddress}`,
  );
}
