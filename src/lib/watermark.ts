// Watermarked previews of drafts and locked final files (migration 073).
// The preview is a smaller JPEG with the watermark burned into the pixels —
// one big tilted Thrive logo, tone on tone with a darker outline, and
// "DRAFT FOR <client>" small along the bottom — so a screenshot or a saved
// copy is still marked.
// Transparent artwork (logos) sits on a plain backdrop picked so the marks show. The letters are drawn as lines (a small built-in stroke font), not
// text, because the server has no fonts to render text with.

import 'server-only';
import sharp from 'sharp';

/** Files a preview can be made from. */
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|tiff?|svg)$/i;
export function canPreview(name: string): boolean {
  return IMAGE_EXT.test(name);
}

const MAX_SIDE = 1400;

// 4 × 6 grid per letter, y down; each entry is one stroke (x,y pairs).
const GLYPHS: Record<string, number[][]> = {
  A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 3.5, 4, 3.5]],
  B: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3], [0, 0, 3, 0, 4, 1, 4, 2, 3, 3]],
  C: [[4, 0, 0, 0, 0, 6, 4, 6]],
  D: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 1, 3, 0, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 2, 3]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[0, 0, 4, 0], [2, 0, 2, 6], [0, 6, 4, 6]],
  J: [[4, 0, 4, 6, 0, 6, 0, 4]],
  K: [[0, 0, 0, 6], [4, 0, 0, 3, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]],
  P: [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3]],
  Q: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [2.5, 4.5, 4.5, 6.5]],
  R: [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3], [1.5, 3, 4, 6]],
  S: [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 6, 4, 6, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
  Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  0: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [4, 0, 0, 6]],
  1: [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
  2: [[0, 0, 4, 0, 4, 3, 0, 3, 0, 6, 4, 6]],
  3: [[0, 0, 4, 0, 4, 6, 0, 6], [1, 3, 4, 3]],
  4: [[0, 0, 0, 3, 4, 3], [4, 0, 4, 6]],
  5: [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]],
  6: [[4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 0, 3]],
  7: [[0, 0, 4, 0, 1, 6]],
  8: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [0, 3, 4, 3]],
  9: [[4, 3, 0, 3, 0, 0, 4, 0, 4, 6, 0, 6]],
  '·': [[1.9, 3, 2.1, 3]],
  '-': [[0.5, 3, 3.5, 3]],
  '.': [[1.9, 6, 2.1, 6]],
  '&': [[4, 6, 0, 2, 1, 0, 3, 0, 3, 2, 0, 4, 0, 6, 2, 6, 4, 4]],
};
const ADVANCE = 6;

/** One line of text as an SVG path `d`, `size` = letter height in px, from (x, y) top-left. */
function textPath(text: string, x: number, y: number, size: number): string {
  const k = size / 6;
  let d = '';
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) for (const s of g) {
      d += 'M' + s.map((v, i) => (i % 2 ? (y + v * k) : (cx + v * k)).toFixed(1)).join(' ').replace(/^(\S+) (\S+)/, '$1 $2 L');
    }
    cx += ADVANCE * k;
  }
  return d;
}
function textWidth(text: string, size: number) {
  return text.length * ADVANCE * (size / 6) - 2 * (size / 6);
}

function clean(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9 ·&.-]/g, '').replace(/\s+/g, ' ').trim();
}

// The Thrive logo (public/new-thrive/logo-white.svg), inlined: files in public/
// aren't inside the function on Vercel. viewBox 0 0 526.74 178.01.
const LOGO_W = 526.74;
const LOGO_H = 178.01;
const LOGO_PATHS = [
  'M119.34,177.3c-3.52,0-5.06-1.55-5.06-5.06V14.4c0-3.52,1.55-5.06,5.06-5.06h21.81c3.52,0,5.07,1.55,5.07,5.06v54.55h23.49V14.4c0-3.52,1.55-5.06,5.07-5.06h21.81c3.52,0,5.06,1.55,5.06,5.06v157.83c0,3.52-1.55,5.06-5.06,5.06h-21.81c-3.52,0-5.07-1.55-5.07-5.06v-73.88h-23.49v73.88c0,3.52-1.55,5.06-5.07,5.06h-21.81Z',
  'M212.15,177.3c-3.52,0-5.07-1.55-5.07-5.06V44.31c0-3.52,1.55-5.06,5.07-5.06h46.85c21.1,0,27.72,9.57,27.72,23.49v6.47c0,7.88-1.97,13.51-7.88,16.04,10.27,1.13,17.02,8.58,17.02,20.4v66.58c0,3.52-1.55,5.06-5.07,5.06h-21.8c-3.52,0-5.07-1.55-5.07-5.06v-58.28c0-4.22-1.41-6.05-5.35-6.05h-19.7v64.33c0,3.52-1.55,5.06-5.06,5.06h-21.67ZM238.88,82.58h10.55c4.92,0,6.19-2.81,6.19-6.61v-4.78c0-3.8-1.27-6.61-6.19-6.61h-10.55v18.01Z',
  'M383.04,177.89c-3.66,0-5.77-1.13-7.17-4.64l-13.79-34.47c-3.38-8.44-4.5-11.11-4.5-19.98V43.72c0-3.52,1.55-5.06,5.07-5.06h22.37c3.52,0,5.49,1.55,5.49,5.06v76.77c0,1.97.42,3.66,1.13,5.77l6.61,19.7c.56,1.83,1.13,2.39,2.67,2.39h1.55c1.55,0,2.11-.56,2.67-2.39l6.61-19.84c.7-2.11,1.13-3.8,1.13-5.77V15.4c0-3.52,1.55-5.06,5.06-5.06h22.09c3.66,0,5.06,1.55,5.06,5.06v103.4c0,8.86-1.13,11.54-4.5,19.98l-13.79,34.47c-1.41,3.52-3.52,4.64-7.18,4.64h-36.58Z',
  'M456.4,178.01c-3.52,0-5.07-1.55-5.07-5.06V15.4c0-3.52,1.55-5.06,5.07-5.06h65.28c3.52,0,5.06,1.55,5.06,5.06v16.46c0,3.52-1.55,5.06-5.06,5.06h-38.83v45.92h27.43c3.52,0,5.07,1.55,5.07,5.06v15.05c0,3.52-1.55,5.06-5.07,5.06h-27.43v43.4h38.83c3.52,0,5.06,1.55,5.06,5.07v16.46c0,3.52-1.55,5.06-5.06,5.06h-65.28Z',
  'M40.53,177.02c-3.52,0-5.06-1.55-5.06-5.06l.48-75.85H5.06c-3.52,0-5.06-1.55-5.06-5.06v-17.02c0-3.52,1.55-5.06,5.06-5.06h93.72c3.52,0,5.06,1.55,5.06,5.06v17.02c0,3.52-1.55,5.06-5.06,5.06h-29.93l-.48,75.85c0,3.52-1.55,5.06-5.07,5.06h-22.79Z',
  'M300.47,173.39v-15.27c0-3.21,1.41-4.62,4.62-4.62h13.44V34.1h-13.44c-3.21,0-4.62-1.41-4.62-4.62v-14.08c0-3.21,1.41-5.06,4.62-5.06h98.75c3.21,0,4.62,1.86,4.62,5.06v14.08c0,3.21-1.41,4.62-4.62,4.62h-55.8v119.41h12.44c3.21,0,4.62,1.41,4.62,4.62v15.27c0,3.21-1.41,4.62-4.62,4.62h-55.39c-3.21,0-4.62-1.41-4.62-4.62Z',
  'M211.7,9.34h79.54c2.55,0,4.62,2.07,4.62,4.62v15.52c0,2.55-2.07,4.62-4.62,4.62h-79.54c-2.55,0-4.62-2.07-4.62-4.62v-15.52c0-2.55,2.07-4.62,4.62-4.62Z',
  'M45.36,39.31h15.01c2.55,0,4.62,2.07,4.62,4.62v15.52c0,2.55-2.07,4.62-4.62,4.62h-15.01c-2.55,0-4.62-2.07-4.62-4.62v-15.52c0-2.55,2.07-4.62,4.62-4.62Z',
  'M71.91,58.86c-2.95-1.25-4.13-1.92-4.13-5.13v-3.86c0-3.21,1.27-3.83,4.19-5.15,9.09-4.09,17.08-5.84,27.26-5.42,3.2.13,4.62,1.41,4.62,4.62v14.47c0,3.21-1.41,4.47-4.62,4.62-9.86.47-18.54-.42-27.32-4.16Z',
  'M59.14,31.94c-1.25,2.95-1.92,4.13-5.13,4.13h-3.86c-3.21,0-3.83-1.27-5.15-4.19-4.09-9.09-5.84-17.08-5.42-27.26C39.72,1.41,41,0,44.21,0h14.47c3.21,0,4.47,1.41,4.62,4.62.47,9.86-.42,18.54-4.16,27.32Z',
  'M73.34,40.47c-3.01,1.11-4.33,1.42-6.52-.92l-2.64-2.81c-2.19-2.34-1.7-3.66-.47-6.62,3.83-9.2,8.46-15.95,16.17-22.61,2.43-2.1,4.33-2.13,6.53.21l9.9,10.55c2.19,2.34,2.03,4.22-.21,6.53-6.87,7.09-13.81,12.38-22.77,15.67Z',
  'M31.94,58.86c2.95-1.25,4.13-1.92,4.13-5.13v-3.86c0-3.21-1.27-3.83-4.19-5.15-9.09-4.09-17.08-5.84-27.26-5.42C1.41,39.44,0,40.72,0,43.93v14.47c0,3.21,1.41,4.47,4.62,4.62,9.86.47,18.54-.42,27.32-4.16Z',
  'M30.51,40.47c3.01,1.11,4.33,1.42,6.52-.92l2.64-2.81c2.19-2.34,1.7-3.66.47-6.62-3.83-9.2-8.46-15.95-16.17-22.61-2.43-2.1-4.33-2.13-6.53.21l-9.9,10.55c-2.19,2.34-2.03,4.22.21,6.53,6.87,7.09,13.81,12.38,22.77,15.67Z',
];

/**
 * One big Thrive logo across the middle, tilted, tone on tone: a darker
 * "sticker" outline around a lighter logo, both see-through, so it reads on
 * light and dark artwork without hiding it. The client's name runs small along
 * the bottom in the same tone, so a copy still says who it was sent to.
 */
function overlaySvg(w: number, h: number, line: string): string {
  const d = LOGO_PATHS.map((p) => `<path d="${p}"/>`).join('');
  // Sized so the tilted logo spans most of the picture.
  const scale = Math.min((Math.hypot(w, h) * 0.62) / LOGO_W, (Math.min(w, h) * 0.42) / LOGO_H);
  const halo = 26; // outline thickness, in logo units
  const small = Math.max(9, Math.round(Math.min(w, h) / 70));
  const lineW = textWidth(line, small);
  const nameD = textPath(line, w - lineW - small * 1.6, h - small * 2.6, small);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g transform="translate(${w / 2} ${h / 2}) rotate(-40) scale(${scale.toFixed(4)}) translate(${-LOGO_W / 2} ${-LOGO_H / 2})">
    <g opacity="0.2" fill="#000" stroke="#000" stroke-width="${halo * 2}" stroke-linejoin="round" stroke-linecap="round">${d}</g>
    <g opacity="0.16" fill="#fff">${d}</g>
  </g>
  <path d="${nameD}" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="${Math.max(2.4, small / 3)}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${nameD}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="${Math.max(1.1, small / 7)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/**
 * A plain backdrop for transparent artwork: dark behind light marks (a white
 * logo), light behind dark ones — from the average of the visible pixels.
 */
async function backdropFor(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let weight = 0, lum = 0, see = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3] / 255;
    if (a < 0.99) see++;
    weight += a;
    lum += a * (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  }
  if (see === 0) return null; // nothing see-through
  return weight && lum / weight > 150 ? '#2b2b2b' : '#f2f2f2';
}

/**
 * A watermarked preview of an image file. `big` (DRAFT / PREVIEW) starts the name line
 * (DRAFT / PREVIEW); `who` is the client's name, repeated in the small rows.
 */
export async function watermarkedPreview(original: Buffer, name: string, big: 'DRAFT' | 'PREVIEW', who: string): Promise<Buffer> {
  const isSvg = /\.svg$/i.test(name);
  const art = await sharp(original, { density: isSvg ? 300 : 72, animated: false })
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: !isSvg })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = art.info;
  const line = clean(`${big} FOR ${who || 'REVIEW'} · THRIVE CREATIVE STUDIOS`);

  const backdrop = (await backdropFor(art.data)) ?? '#ffffff';
  return sharp({ create: { width: w, height: h, channels: 3, background: backdrop } })
    .composite([
      { input: art.data },
      { input: Buffer.from(overlaySvg(w, h, line)) },
    ])
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 72, mozjpeg: true })
    .withMetadata({ exif: { IFD0: { Copyright: `${big} for ${who || 'review'} — Thrive Creative Studios. Not for use.` } } })
    .toBuffer();
}
