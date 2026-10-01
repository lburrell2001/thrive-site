// Importing an email designed elsewhere (Canva Email's "HTML and images"
// export) as a newsletter.
//
// 1. Read the upload: a .zip (HTML + image files) or a single .html file.
// 2. Re-host every image the HTML points at — files from the zip, and any
//    remote URLs — in the public course-media bucket, so the email never
//    depends on someone else's links staying up.
// 3. Sanitize: only email-safe tags and attributes survive. No scripts,
//    forms, iframes, SVG or event handlers; links limited to http(s),
//    mailto and tel.
//
// The unsubscribe footer, mailing address and preview text are added at
// send time (newsletterEmail.ts), not stored, so they always reflect the
// current settings.

import 'server-only';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync } from 'fflate';
import sanitizeHtml from 'sanitize-html';
import { storageUrl } from '@/lib/storage';

export class ImportError extends Error {}

export interface ImportResult {
  html: string;
  meta: { file: string; images: number; bytes: number; warnings: string[]; imported_at: string };
}

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 60;
/** Gmail cuts off ("clips") emails whose HTML is larger than this. */
const GMAIL_CLIP_BYTES = 102 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
};

function extOf(name: string) {
  return (name.split('?')[0].split('.').pop() ?? '').toLowerCase();
}

function normalizePath(p: string) {
  let path = p.split(/[?#]/)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed %-escapes: match on the name as written.
  }
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase();
}

/** Private, loopback, link-local and cloud-metadata addresses. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || (v.startsWith('::ffff:') && isPrivateAddress(v.slice(7)));
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Only fetch public https images. The URLs come from an uploaded file, so
 * don't let one point the server at its own network.
 */
async function isPublicHttps(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  try {
    const addresses = await lookup(url.hostname, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

/** Every image URL an email can reference: src, background, CSS url(). */
function imageRefs(html: string): string[] {
  const refs = new Set<string>();
  // Only image tags' src — an iframe or script src isn't an image, and is
  // stripped by the sanitizer anyway.
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1].trim());
  for (const m of html.matchAll(/\bbackground\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1].trim());
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.add(m[1].trim());
  return [...refs].filter((r) => r && !r.startsWith('data:') && !r.startsWith('cid:') && !r.startsWith('#'));
}

async function upload(db: SupabaseClient, newsletterId: string, bytes: Uint8Array, ext: string) {
  const type = IMAGE_TYPES[ext];
  if (!type) return null;
  const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 20);
  const path = `newsletters/imports/${newsletterId}/${hash}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const { error } = await db.storage.from('course-media').upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw new ImportError(`Could not store an image: ${error.message}`);
  return storageUrl(path);
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  if (!(await isPublicHttps(url))) return null;
  try {
    // No redirects: a public URL must not bounce the request somewhere private.
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = Object.entries(IMAGE_TYPES).find(([, t]) => t === type)?.[0] ?? extOf(url);
    if (!IMAGE_TYPES[ext]) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength <= MAX_IMAGE_BYTES ? { bytes: buf, ext } : null;
  } catch {
    return null;
  }
}

const SAFE = {
  allowedTags: [
    'html', 'head', 'body', 'meta', 'title', 'style', 'link',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
    'div', 'span', 'p', 'br', 'hr', 'center', 'font', 'a', 'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'small', 'big', 'pre', 'code',
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height', 'bgcolor', 'background', 'border',
      'cellpadding', 'cellspacing', 'role', 'dir', 'lang', 'title', 'colspan', 'rowspan', 'color', 'face', 'size', 'aria-hidden', 'aria-label'],
    a: ['href', 'target', 'rel', 'name'],
    img: ['src', 'alt', 'width', 'height', 'border'],
    meta: ['charset', 'name', 'content', 'http-equiv'],
    link: ['href', 'rel', 'type'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // <style> is needed for email layout (media queries). It is only ever
  // rendered by mail clients and a sandboxed preview, never on the site.
  allowVulnerableTags: true,
  // Only Google Fonts stylesheets may be linked.
  exclusiveFilter: (frame: sanitizeHtml.IFrame) =>
    frame.tag === 'link' && !/^https:\/\/fonts\.googleapis\.com\//.test(frame.attribs.href ?? ''),
  // Keep <html>/<head>/<body> so the email keeps its structure.
  enforceHtmlBoundary: false,
} satisfies sanitizeHtml.IOptions;

export async function importDesign(
  db: SupabaseClient,
  newsletterId: string,
  file: { name: string; bytes: Uint8Array },
): Promise<ImportResult> {
  const warnings: string[] = [];
  const name = file.name;
  let html: string;
  const files = new Map<string, Uint8Array>();

  if (extOf(name) === 'zip') {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(file.bytes);
    } catch {
      throw new ImportError('That zip file could not be opened');
    }
    const htmlFiles = Object.keys(entries).filter((p) => /\.html?$/i.test(p) && !p.startsWith('__MACOSX'));
    if (!htmlFiles.length) throw new ImportError('No .html file inside the zip — in Canva, download as "HTML and images"');
    // The main email is the largest HTML file.
    const main = htmlFiles.sort((a, b) => entries[b].byteLength - entries[a].byteLength)[0];
    if (entries[main].byteLength > MAX_HTML_BYTES) throw new ImportError('The email HTML is too large');
    html = new TextDecoder().decode(entries[main]);
    for (const [p, bytes] of Object.entries(entries)) {
      if (IMAGE_TYPES[extOf(p)] && !p.startsWith('__MACOSX')) {
        files.set(normalizePath(p), bytes);
        files.set(normalizePath(p.split('/').pop() ?? p), bytes);
      }
    }
  } else if (/^html?$/.test(extOf(name))) {
    if (file.bytes.byteLength > MAX_HTML_BYTES) throw new ImportError('The email HTML is too large');
    html = new TextDecoder().decode(file.bytes);
  } else {
    throw new ImportError('Upload the .zip from Canva (HTML and images), or an .html file');
  }

  // Re-host images before sanitizing, so every src points somewhere we own.
  const refs = imageRefs(html);
  if (refs.length > MAX_IMAGES) throw new ImportError(`This design has ${refs.length} images — the limit is ${MAX_IMAGES}`);
  let images = 0;
  const missing: string[] = [];
  // Longest first, so "logo.png" can't clobber part of "logo.png?v=2".
  for (const ref of refs.sort((a, b) => b.length - a.length)) {
    let found: { bytes: Uint8Array; ext: string } | null = null;
    if (/^https?:\/\//i.test(ref)) {
      found = await fetchImage(ref);
    } else {
      const bytes = files.get(normalizePath(ref)) ?? files.get(normalizePath(ref.split('/').pop() ?? ref));
      if (bytes && bytes.byteLength <= MAX_IMAGE_BYTES) found = { bytes, ext: extOf(ref) };
    }
    const url = found ? await upload(db, newsletterId, found.bytes, found.ext) : null;
    if (url) {
      html = html.split(ref).join(url);
      images += 1;
    } else {
      missing.push(ref.split('/').pop() ?? ref);
    }
  }
  if (missing.length) {
    warnings.push(`${missing.length} image${missing.length === 1 ? '' : 's'} couldn't be found or loaded (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}) and will appear broken. Re-download from Canva as "HTML and images".`);
  }

  const clean = sanitizeHtml(html, SAFE).trim();
  if (!clean || !/<(table|div|p|img|h\d)\b/i.test(clean)) throw new ImportError('Nothing usable was found in that file');

  const bytes = new TextEncoder().encode(clean).byteLength;
  if (bytes > GMAIL_CLIP_BYTES) {
    warnings.push(`The email is ${Math.round(bytes / 1024)} KB of code. Gmail cuts off emails over about 102 KB and shows "View entire message" — shorten the design or split it.`);
  }
  if (!/<a\b[^>]*href=/i.test(clean)) {
    warnings.push('The design has no links or buttons. Add links in Canva (select text or a button → Link) so people can click through.');
  }

  return {
    html: clean,
    meta: { file: name, images, bytes, warnings, imported_at: new Date().toISOString() },
  };
}
