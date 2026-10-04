// The sections of a designed email, and its design settings.
//
// Shared by the designer (browser), the API (validation) and the email
// renderer, so a block means the same thing everywhere. Every block also
// takes a background colour and spacing; text colour follows the
// background automatically, so a black or magenta band never needs its
// text recoloured by hand.
//
// Older blocks saved before a field existed parse with that field's
// default, so earlier newsletters and templates keep rendering.

import { z } from 'zod';

// ------------------------------------------------------------------ fonts

/**
 * Fonts an email can ask for. Web fonts load in Apple Mail and iOS; Gmail
 * and Outlook ignore them and use the fallback, so every stack ends in a
 * font that exists everywhere and looks close.
 */
export const EMAIL_FONTS = {
  bungee: { label: 'Bungee (headings)', stack: "'Bungee', 'Arial Black', Impact, sans-serif", google: 'Bungee' },
  bai: { label: 'Bai Jamjuree', stack: "'Bai Jamjuree', 'Helvetica Neue', Arial, sans-serif", google: 'Bai+Jamjuree:wght@400;600;700' },
  inter: { label: 'Inter', stack: "'Inter', 'Helvetica Neue', Arial, sans-serif", google: 'Inter:wght@400;600;700;800' },
  poppins: { label: 'Poppins', stack: "'Poppins', 'Helvetica Neue', Arial, sans-serif", google: 'Poppins:wght@400;600;700;800' },
  playfair: { label: 'Playfair Display (serif)', stack: "'Playfair Display', Georgia, 'Times New Roman', serif", google: 'Playfair+Display:wght@400;700' },
  georgia: { label: 'Georgia (serif, no download)', stack: "Georgia, 'Times New Roman', serif", google: null },
  arial: { label: 'Arial (no download)', stack: 'Arial, Helvetica, sans-serif', google: null },
} as const;

export type EmailFont = keyof typeof EMAIL_FONTS;
const FONT_KEYS = Object.keys(EMAIL_FONTS) as [EmailFont, ...EmailFont[]];

// ----------------------------------------------------------------- colour

/** The logo's colours and the neutrals — offered as one-click backgrounds. */
export const SWATCHES = [
  { hex: '#0a0a0a', label: 'Black' },
  { hex: '#ffffff', label: 'White' },
  { hex: '#f5f4f1', label: 'Stone' },
  { hex: '#fff7fb', label: 'Blush' },
  { hex: '#e50586', label: 'Magenta' },
  { hex: '#fd6100', label: 'Orange' },
  { hex: '#3943b7', label: 'Blue' },
  { hex: '#9409ce', label: 'Purple' },
  { hex: '#0cf574', label: 'Green' },
] as const;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** True when white text reads better than black on this colour. */
export function isDark(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) && contrast(hex, '#ffffff') >= contrast(hex, '#0a0a0a');
}

// ----------------------------------------------------------------- design

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #e40586');
const url = z.string().trim().max(500).refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v) || /^mailto:/i.test(v), 'Links must start with https://, mailto: or /');

export const designSchema = z.object({
  pageBg: color,
  contentBg: color,
  textColor: color,
  headingColor: color,
  accent: color,
  buttonText: color,
  headingFont: z.enum(FONT_KEYS),
  bodyFont: z.enum(FONT_KEYS),
  logoUrl: z.string().trim().max(500),
  instagram: url,
  linkedin: url,
  website: url,
  /** Rounded or square corners on images, buttons and the email itself. */
  corners: z.enum(['square', 'soft', 'round']),
  /** Headlines in capitals (Bungee is capitals anyway). */
  uppercase: z.boolean(),
  /** The theme last applied; new sections take its band colours. */
  theme: z.string().max(20),
});

export type NewsletterDesign = z.infer<typeof designSchema>;

export const DEFAULT_DESIGN: NewsletterDesign = {
  pageBg: '#f5f4f1',
  contentBg: '#ffffff',
  textColor: '#2b2b2b',
  headingColor: '#0a0a0a',
  accent: '#e50586',
  buttonText: '#ffffff',
  headingFont: 'bungee',
  bodyFont: 'bai',
  logoUrl: '',
  instagram: 'https://www.instagram.com/thrivecreativestudio_/',
  linkedin: '',
  website: 'https://thrivecreativestudios.org',
  corners: 'soft',
  uppercase: true,
  theme: 'studio',
};

/** One-click looks. Each sets colours, fonts and corners; content stays. */
export interface Theme {
  key: string;
  label: string;
  design: Partial<NewsletterDesign>;
  swatch: [string, string, string];
  /** Band colours for sections that usually have one ('' = the email's own). */
  bands: Partial<Record<BlockType, string>>;
}

export const THEMES: Theme[] = [
  {
    key: 'studio',
    bands: { header: '#0a0a0a', hero: '#0a0a0a', stats: '#f5f4f1', quote: '#fff7fb', cta: '#e50586', footer: '#0a0a0a' },
    label: 'Studio',
    swatch: ['#ffffff', '#0a0a0a', '#e50586'],
    design: { pageBg: '#f5f4f1', contentBg: '#ffffff', textColor: '#2b2b2b', headingColor: '#0a0a0a', accent: '#e50586', buttonText: '#ffffff', headingFont: 'bungee', bodyFont: 'bai', corners: 'soft', uppercase: true, theme: 'studio' },
  },
  {
    key: 'midnight',
    bands: { header: '', hero: '', stats: '#161616', quote: '#161616', cta: '#0cf574', footer: '#000000' },
    label: 'Midnight',
    swatch: ['#0a0a0a', '#ffffff', '#0cf574'],
    design: { pageBg: '#000000', contentBg: '#0a0a0a', textColor: '#d9d9d9', headingColor: '#ffffff', accent: '#0cf574', buttonText: '#0a0a0a', headingFont: 'bungee', bodyFont: 'bai', corners: 'round', uppercase: true, theme: 'midnight' },
  },
  {
    key: 'pop',
    bands: { header: '#3943b7', hero: '#3943b7', stats: '#fff7fb', quote: '#fff7fb', cta: '#fd6100', footer: '#3943b7' },
    label: 'Pop',
    swatch: ['#fff7fb', '#3943b7', '#fd6100'],
    design: { pageBg: '#fff7fb', contentBg: '#ffffff', textColor: '#2b2b2b', headingColor: '#3943b7', accent: '#fd6100', buttonText: '#0a0a0a', headingFont: 'bungee', bodyFont: 'poppins', corners: 'round', uppercase: true, theme: 'pop' },
  },
  {
    key: 'editorial',
    bands: { header: '', hero: '', stats: '#f3ecdf', quote: '#f3ecdf', cta: '#0a0a0a', footer: '#0a0a0a' },
    label: 'Editorial',
    swatch: ['#fffaf0', '#0a0a0a', '#9409ce'],
    design: { pageBg: '#fffaf0', contentBg: '#fffaf0', textColor: '#2b2b2b', headingColor: '#0a0a0a', accent: '#9409ce', buttonText: '#ffffff', headingFont: 'playfair', bodyFont: 'inter', corners: 'square', uppercase: false, theme: 'editorial' },
  },
];

/** Apply a theme: its design, and its band colours on the sections that have one. */
export function applyTheme(theme: Theme, design: NewsletterDesign, blocks: NewsletterBlock[]) {
  return {
    design: { ...design, ...theme.design },
    blocks: blocks.map((b) => (b.type in theme.bands ? ({ ...b, bg: theme.bands[b.type] } as NewsletterBlock) : b)),
  };
}

/** A new section, coloured for the email's theme. */
export function newSection(type: BlockType, design: NewsletterDesign): NewsletterBlock {
  const b = newBlock(type);
  const theme = THEMES.find((t) => t.key === design.theme);
  return theme && type in theme.bands ? ({ ...b, bg: theme.bands[type] } as NewsletterBlock) : b;
}

/** A stored design, with anything missing or invalid filled from the defaults. */
export function resolveDesign(input: unknown): NewsletterDesign {
  const parsed = designSchema.partial().safeParse(input ?? {});
  return { ...DEFAULT_DESIGN, ...(parsed.success ? parsed.data : {}) };
}

// ----------------------------------------------------------------- blocks

const align = z.enum(['left', 'center']);
const text = (max: number) => z.string().max(max);

/** Every block: a background ('' = the email's) and how much room around it. */
const section = {
  id: z.string(),
  bg: z.union([color, z.literal('')]).optional(),
  /** Unset on blocks saved before spacing existed: the renderer uses each type's old spacing. */
  pad: z.enum(['none', 'small', 'medium', 'large']).optional(),
};

const imagePart = z.object({
  src: z.string().trim().max(600),
  alt: text(200),
  href: url.optional().default(''),
});

export type ImagePart = z.infer<typeof imagePart>;

const galleryItem = imagePart.extend({ title: text(120).optional().default(''), caption: text(200).optional().default('') });
const statItem = z.object({ value: text(24), label: text(80) });
const featureItem = z.object({ title: text(120), text: text(600) });
const navLink = z.object({ label: text(30), href: url });

export const blockSchema = z.discriminatedUnion('type', [
  // --- layout sections
  z.object({ ...section, type: z.literal('header'), links: z.array(navLink).max(3).default([]) }),
  z.object({
    ...section, type: z.literal('hero'),
    eyebrow: text(60).default(''),
    headline: text(160),
    text: text(1000).default(''),
    buttonLabel: text(60).default(''),
    buttonHref: url.default(''),
    image: imagePart.default({ src: '', alt: '', href: '' }),
    /** Where the image sits relative to the words. */
    imagePosition: z.enum(['none', 'above', 'below']).default('below'),
    align: align.default('left'),
  }),
  z.object({
    ...section, type: z.literal('gallery'),
    eyebrow: text(60).default(''),
    heading: text(160).default(''),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    items: z.array(galleryItem).min(1).max(6),
  }),
  z.object({ ...section, type: z.literal('stats'), items: z.array(statItem).min(1).max(3) }),
  z.object({
    ...section, type: z.literal('features'),
    eyebrow: text(60).default(''),
    heading: text(160).default(''),
    numbered: z.boolean().default(true),
    items: z.array(featureItem).min(1).max(6),
  }),
  z.object({ ...section, type: z.literal('quote'), text: text(600), name: text(80).default(''), role: text(120).default('') }),
  z.object({
    ...section, type: z.literal('cta'),
    headline: text(160),
    text: text(600).default(''),
    buttonLabel: text(60),
    buttonHref: url,
    align: align.default('center'),
  }),
  z.object({ ...section, type: z.literal('footer'), tagline: text(160).default('') }),
  // --- basic pieces
  z.object({
    ...section, type: z.literal('image'),
    ...imagePart.shape,
    /** 'full' runs edge to edge; 'padded' sits inside the content margins. */
    width: z.enum(['full', 'padded']),
  }),
  z.object({ ...section, type: z.literal('heading'), eyebrow: text(60).optional().default(''), text: text(200), size: z.enum(['large', 'medium']), align }),
  z.object({ ...section, type: z.literal('text'), text: text(5000), align }),
  z.object({ ...section, type: z.literal('button'), label: text(60), href: url, align }),
  z.object({
    ...section, type: z.literal('columns'),
    image: imagePart,
    heading: text(160),
    text: text(1500),
    buttonLabel: text(60),
    buttonHref: url,
    imageSide: z.enum(['left', 'right']),
  }),
  z.object({ ...section, type: z.literal('divider') }),
  z.object({ ...section, type: z.literal('spacer'), size: z.enum(['small', 'medium', 'large']) }),
  z.object({ ...section, type: z.literal('social') }),
]);

export type NewsletterBlock = z.output<typeof blockSchema>;
export type BlockType = NewsletterBlock['type'];
export type BlockOf<T extends BlockType> = Extract<NewsletterBlock, { type: T }>;

export const blocksSchema = z.array(blockSchema).max(60);

/** Stored blocks, with defaults filled in for fields added since they were saved. */
export function normalizeBlocks(input: unknown): NewsletterBlock[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((b) => {
    const parsed = blockSchema.safeParse(b);
    return parsed.success ? [parsed.data] : [];
  });
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  header: 'Logo bar',
  hero: 'Hero',
  gallery: 'Project grid',
  stats: 'Numbers',
  features: 'Services list',
  quote: 'Testimonial',
  cta: 'Call to action',
  footer: 'Footer',
  image: 'Image',
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  columns: 'Image + text',
  divider: 'Divider',
  spacer: 'Space',
  social: 'Social links',
};

export const BLOCK_HINT: Record<BlockType, string> = {
  header: 'Your logo, with up to three links',
  hero: 'Big headline, short line, button and image',
  gallery: 'One to three images across, with captions',
  stats: 'Two or three big numbers',
  features: 'Numbered services or steps',
  quote: 'A client’s words, large',
  cta: 'A coloured band with one ask',
  footer: 'Logo mark, socials and a sign-off',
  image: 'One image, edge to edge or inset',
  heading: 'A heading with an optional label above',
  text: 'Paragraphs, bold, links and lists',
  button: 'A single button',
  columns: 'Image beside text',
  divider: 'A thin line',
  spacer: 'Empty space',
  social: 'Instagram, LinkedIn, website',
};

/** Order of the "Add a section" picker. */
export const SECTION_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: 'Sections', types: ['header', 'hero', 'gallery', 'features', 'stats', 'quote', 'cta', 'footer'] },
  { label: 'Basics', types: ['heading', 'text', 'image', 'button', 'columns', 'divider', 'spacer', 'social'] },
];

/** Every image a block shows, for "every image needs a file and a description". */
export function blockImages(b: NewsletterBlock): ImagePart[] {
  switch (b.type) {
    case 'image': return [b];
    case 'columns': return [b.image];
    case 'hero': return b.imagePosition === 'none' ? [] : [b.image];
    case 'gallery': return b.items;
    default: return [];
  }
}

/** Keys that hold words a reader sees (as opposed to links, colours, ids). */
const NON_TEXT = new Set(['id', 'type', 'src', 'href', 'buttonHref', 'bg', 'pad', 'align', 'size', 'width', 'imageSide', 'imagePosition', 'columns', 'numbered']);

/** Apply fn to every piece of visible text in a block (merge fields, placeholders). */
export function mapBlockText(b: NewsletterBlock, fn: (s: string) => string): NewsletterBlock {
  const walk = (v: unknown, key = ''): unknown => {
    if (typeof v === 'string') return NON_TEXT.has(key) ? v : fn(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(b) as NewsletterBlock;
}

export function blockTexts(b: NewsletterBlock): string[] {
  const out: string[] = [];
  mapBlockText(b, (s) => { out.push(s); return s; });
  return out;
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

const base = (pad: NewsletterBlock['pad'] = 'medium', bg = '') => ({ id: newId(), bg, pad });

export function newBlock(type: BlockType): NewsletterBlock {
  switch (type) {
    case 'header': return { ...base('small', '#0a0a0a'), type, links: [{ label: 'Work', href: '/portfolio' }, { label: 'Book a call', href: '/book' }] };
    case 'hero': return {
      ...base('large', '#0a0a0a'), type,
      eyebrow: 'New work',
      headline: 'A headline worth opening for',
      text: 'One or two sentences that make them want to see more.',
      buttonLabel: 'See the project', buttonHref: '/portfolio',
      image: { src: '', alt: '', href: '' }, imagePosition: 'below', align: 'left',
    };
    case 'gallery': return {
      ...base(), type, eyebrow: 'Recent work', heading: 'Fresh off the desk', columns: 2,
      items: [
        { src: '', alt: '', href: '/portfolio', title: 'Project name', caption: 'Brand identity' },
        { src: '', alt: '', href: '/portfolio', title: 'Project name', caption: 'Website' },
      ],
    };
    case 'stats': return {
      ...base('medium', '#f5f4f1'), type,
      items: [{ value: '40+', label: 'brands launched' }, { value: '3×', label: 'more inquiries' }, { value: '5★', label: 'client reviews' }],
    };
    case 'features': return {
      ...base(), type, eyebrow: 'What we do', heading: 'Design that does the selling', numbered: true,
      items: [
        { title: 'Brand identity', text: 'Logos, colour and type that make you recognisable.' },
        { title: 'Websites', text: 'Fast, clear sites that turn visitors into calls.' },
        { title: 'Social content', text: 'Templates and campaigns that stay on-brand.' },
      ],
    };
    case 'quote': return { ...base('large', '#fff7fb'), type, text: 'Working with Thrive changed how people see our business.', name: 'Client name', role: 'Owner, Company' };
    case 'cta': return { ...base('large', '#e50586'), type, headline: 'Ready when you are', text: 'Fifteen minutes, no pressure — just ideas.', buttonLabel: 'Book a call', buttonHref: '/book', align: 'center' };
    case 'footer': return { ...base('medium', '#0a0a0a'), type, tagline: 'Design that makes you look as good as your work.' };
    case 'image': return { ...base('none'), type, src: '', alt: '', href: '', width: 'full' };
    case 'heading': return { ...base('small'), type, eyebrow: '', text: 'A headline worth opening for', size: 'large', align: 'left' };
    case 'text': return { ...base('small'), type, text: 'Write a few short sentences. **Bold** and [links](/portfolio) work here.', align: 'left' };
    case 'button': return { ...base('small'), type, label: 'See the project', href: '/portfolio', align: 'left' };
    case 'columns': return { ...base(), type, image: { src: '', alt: '', href: '' }, heading: 'Side story', text: 'A short paragraph next to an image.', buttonLabel: '', buttonHref: '', imageSide: 'left' };
    case 'divider': return { ...base('small'), type };
    case 'spacer': return { ...base('none'), type, size: 'medium' };
    case 'social': return { ...base('small'), type };
  }
}

/** The layout a blank designed email starts with. */
export function starterBlocks(): NewsletterBlock[] {
  return (['header', 'hero', 'gallery', 'features', 'quote', 'cta', 'footer'] as BlockType[]).map(newBlock);
}
