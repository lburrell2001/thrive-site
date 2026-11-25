// Asset requests (migration 075): what Lauren asks a client to send her —
// logo files, photos, copy — and the rules both sides share. Pure, so the
// admin builder, the portal page and the server all agree.

export type AssetStatus = 'open' | 'submitted' | 'received';

export interface AssetFile { path: string; name: string; size: number; type: string; uploaded_at?: string; url?: string | null }

export interface AssetItem {
  id: string;
  position: number;
  label: string;
  hint: string | null;
  required: boolean;
  files: AssetFile[];
  link: string | null;
  client_note: string | null;
  unavailable: boolean;
}

export interface AssetRequest {
  id: string;
  client_id: string;
  project_id: string | null;
  project_name: string | null;
  title: string;
  note: string | null;
  due_date: string | null;
  status: AssetStatus;
  submitted_at: string | null;
  received_at: string | null;
  created_at: string;
  items: AssetItem[];
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
  open: 'Waiting on them',
  submitted: 'Sent — ready to check',
  received: 'Received',
};

/** One-click items in the builder. */
export const ASSET_PRESETS: { label: string; hint: string }[] = [
  { label: 'Logo files', hint: 'The original files if you have them (AI, EPS, SVG or PDF), plus any PNGs.' },
  { label: 'Brand guide, colors and fonts', hint: 'A brand guide if you have one, or your color codes and font names.' },
  { label: 'Photos', hint: 'Your business, products, space or work. The highest quality you have, straight from your phone is fine.' },
  { label: 'Headshots', hint: 'You and your team, for the About page or social.' },
  { label: 'Website copy', hint: 'Text for each page, even rough notes. A Word or Google Doc is perfect.' },
  { label: 'Services or products with prices', hint: 'Names, short descriptions and prices.' },
  { label: 'Testimonials', hint: 'Reviews or kind words from customers, with their name if they’re happy to share it.' },
  { label: 'Videos', hint: 'Any clips you’d like used. Big files are easier as a Google Drive or Dropbox link.' },
  { label: 'Printed materials', hint: 'Menus, brochures, flyers or cards you use now.' },
  { label: 'Designs you love', hint: 'Screenshots or links of websites, brands or posts whose look you like.' },
];

/** Starting lists by kind of project. */
export const ASSET_BUNDLES: { name: string; title: string; items: string[] }[] = [
  { name: 'Website', title: 'Files for your website', items: ['Logo files', 'Brand guide, colors and fonts', 'Photos', 'Website copy', 'Services or products with prices', 'Testimonials'] },
  { name: 'Branding', title: 'Files for your brand', items: ['Logo files', 'Printed materials', 'Designs you love'] },
  { name: 'Social media', title: 'Files for your social media', items: ['Logo files', 'Brand guide, colors and fonts', 'Photos', 'Videos', 'Designs you love'] },
  { name: 'Photography', title: 'Before your shoot', items: ['Designs you love', 'Brand guide, colors and fonts'] },
];

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_ITEM = 30;
export const MAX_ITEMS = 30;

/** By extension: browsers report no type for AI, EPS, fonts and the like. */
export const ASSET_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'tif', 'tiff', 'bmp',
  'ai', 'eps', 'psd', 'indd', 'idml', 'fig', 'sketch', 'xd', 'afdesign', 'afphoto', 'cdr',
  'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng',
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'key', 'pages', 'xls', 'xlsx', 'numbers', 'csv', 'txt', 'rtf', 'md',
  'otf', 'ttf', 'woff', 'woff2',
  'mp4', 'mov', 'm4v', 'webm', 'avi', 'mp3', 'wav', 'm4a',
  'zip',
];
export const ASSET_ACCEPT = ASSET_EXTENSIONS.map((e) => `.${e}`).join(',') + ',image/*,video/*';

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,10})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

export function assetFileProblem(file: { name: string; size: number }): string | null {
  if (!ASSET_EXTENSIONS.includes(extOf(file.name))) return `${file.name}: that kind of file can’t be uploaded here. Images, PDFs, documents, design files, fonts, videos and ZIPs work.`;
  if (!(file.size > 0)) return `${file.name} is empty.`;
  if (file.size > MAX_ASSET_BYTES) return `${file.name} is over 50 MB. Paste a Google Drive, Dropbox or WeTransfer link instead.`;
  return null;
}

/** Something sent for it: a file, a link, a note, or "I don't have this". */
export function itemAnswered(i: Pick<AssetItem, 'files' | 'link' | 'client_note' | 'unavailable'>): boolean {
  return i.files.length > 0 || Boolean(i.link?.trim()) || i.unavailable || Boolean(i.client_note?.trim());
}

export function progressOf(items: AssetItem[]) {
  return { done: items.filter(itemAnswered).length, total: items.length };
}

/** Required items with nothing sent yet. */
export function missingItems(items: AssetItem[]): AssetItem[] {
  return items.filter((i) => i.required && !itemAnswered(i));
}

/** Only http(s) links; "drive.google.com/…" gets https:// added. */
export function cleanLink(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
