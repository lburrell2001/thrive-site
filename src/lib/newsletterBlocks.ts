// The building blocks of a designed newsletter, and its design settings.
//
// Shared by the editor (browser), the API (validation) and the email
// renderer, so a block means the same thing everywhere.

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
  inter: { label: 'Inter', stack: "'Inter', 'Helvetica Neue', Arial, sans-serif", google: 'Inter:wght@400;600;700' },
  poppins: { label: 'Poppins', stack: "'Poppins', 'Helvetica Neue', Arial, sans-serif", google: 'Poppins:wght@400;600;700' },
  playfair: { label: 'Playfair Display (serif)', stack: "'Playfair Display', Georgia, 'Times New Roman', serif", google: 'Playfair+Display:wght@400;700' },
  georgia: { label: 'Georgia (serif, no download)', stack: "Georgia, 'Times New Roman', serif", google: null },
  arial: { label: 'Arial (no download)', stack: 'Arial, Helvetica, sans-serif', google: null },
} as const;

export type EmailFont = keyof typeof EMAIL_FONTS;
const FONT_KEYS = Object.keys(EMAIL_FONTS) as [EmailFont, ...EmailFont[]];

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
});

export type NewsletterDesign = z.infer<typeof designSchema>;

export const DEFAULT_DESIGN: NewsletterDesign = {
  pageBg: '#f6f5f4',
  contentBg: '#ffffff',
  textColor: '#222222',
  headingColor: '#0a0a0a',
  accent: '#e40586',
  buttonText: '#ffffff',
  headingFont: 'bungee',
  bodyFont: 'bai',
  logoUrl: '',
  instagram: 'https://www.instagram.com/thrivecreativestudio_/',
  linkedin: '',
  website: 'https://thrivecreativestudios.org',
};

/** A stored design, with anything missing or invalid filled from the defaults. */
export function resolveDesign(input: unknown): NewsletterDesign {
  const parsed = designSchema.partial().safeParse(input ?? {});
  return { ...DEFAULT_DESIGN, ...(parsed.success ? parsed.data : {}) };
}

// ----------------------------------------------------------------- blocks

const align = z.enum(['left', 'center']);
const text = (max: number) => z.string().max(max);

const imagePart = z.object({
  src: z.string().trim().max(600),
  alt: text(200),
  href: url.optional().default(''),
});

export const blockSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(), type: z.literal('image'),
    ...imagePart.shape,
    /** 'full' runs edge to edge; 'padded' sits inside the content margins. */
    width: z.enum(['full', 'padded']),
  }),
  z.object({ id: z.string(), type: z.literal('heading'), text: text(200), size: z.enum(['large', 'medium']), align }),
  z.object({ id: z.string(), type: z.literal('text'), text: text(5000), align }),
  z.object({ id: z.string(), type: z.literal('button'), label: text(60), href: url, align }),
  z.object({
    id: z.string(), type: z.literal('columns'),
    image: imagePart,
    heading: text(160),
    text: text(1500),
    buttonLabel: text(60),
    buttonHref: url,
    imageSide: z.enum(['left', 'right']),
  }),
  z.object({ id: z.string(), type: z.literal('divider') }),
  z.object({ id: z.string(), type: z.literal('spacer'), size: z.enum(['small', 'medium', 'large']) }),
  z.object({ id: z.string(), type: z.literal('social') }),
]);

export type NewsletterBlock = z.infer<typeof blockSchema>;
export type BlockType = NewsletterBlock['type'];

export const blocksSchema = z.array(blockSchema).max(60);

export const BLOCK_LABEL: Record<BlockType, string> = {
  image: 'Image',
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  columns: 'Image + text',
  divider: 'Divider',
  spacer: 'Space',
  social: 'Social links',
};

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function newBlock(type: BlockType): NewsletterBlock {
  const id = newId();
  switch (type) {
    case 'image': return { id, type, src: '', alt: '', href: '', width: 'full' };
    case 'heading': return { id, type, text: 'A headline worth opening for', size: 'large', align: 'left' };
    case 'text': return { id, type, text: 'Write a few short sentences. **Bold** and [links](/portfolio) work here.', align: 'left' };
    case 'button': return { id, type, label: 'See the project', href: '/portfolio', align: 'left' };
    case 'columns': return { id, type, image: { src: '', alt: '', href: '' }, heading: 'Side story', text: 'A short paragraph next to an image.', buttonLabel: '', buttonHref: '', imageSide: 'left' };
    case 'divider': return { id, type };
    case 'spacer': return { id, type, size: 'medium' };
    case 'social': return { id, type };
  }
}

/** The layout a blank designed newsletter starts with. */
export function starterBlocks(): NewsletterBlock[] {
  return [
    { ...newBlock('image'), alt: 'Banner' } as NewsletterBlock,
    newBlock('heading'),
    newBlock('text'),
    newBlock('button'),
    newBlock('divider'),
    newBlock('columns'),
    newBlock('social'),
  ];
}
