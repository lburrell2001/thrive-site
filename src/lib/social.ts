// Instagram and Facebook on a contact, and DMs logged to them. Pure — used
// by the server and the browser.

export const DM_PLATFORMS = ['instagram', 'facebook'] as const;
export type DmPlatform = (typeof DM_PLATFORMS)[number];
export const DM_PLATFORM_LABEL: Record<DmPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook' };

export const DM_DIRECTIONS = ['sent', 'received'] as const;
export type DmDirection = (typeof DM_DIRECTIONS)[number];
export const DM_DIRECTION_LABEL: Record<DmDirection, string> = { sent: 'I sent a DM', received: 'They replied' };

export interface DmDetails {
  platform: DmPlatform;
  direction: DmDirection;
}

const IG_HANDLE = /^[a-z0-9._]{1,30}$/;

/**
 * "@Bloom.Bakery", "instagram.com/bloom.bakery/" or a full link with
 * tracking → "bloom.bakery". Null if it isn't a handle.
 */
export function normalizeInstagram(input: string | null | undefined): string | null {
  let v = (input ?? '').trim();
  if (!v) return null;
  const url = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i.exec(v);
  if (url) {
    // A link to a post or reel, not a profile.
    if (/^(p|reel|reels|stories|explore|tv)$/i.test(url[1])) return null;
    v = url[1];
  }
  v = v.replace(/^@/, '').toLowerCase();
  return IG_HANDLE.test(v) ? v : null;
}

/**
 * "facebook.com/BloomBakery", "fb.com/x", "@bloombakery" or a profile.php
 * link → the part after facebook.com/. Null if it isn't a page.
 */
export function normalizeFacebook(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  if (!v) return null;
  const url = /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/(.+)$/i.exec(v);
  if (!url) {
    const handle = v.replace(/^@/, '').toLowerCase();
    return /^[a-z0-9.]{3,80}$/.test(handle) ? handle : null;
  }
  const [path, query = ''] = url[1].split('#')[0].split('?');
  const clean = path.replace(/\/+$/, '');
  if (!clean || /\s/.test(clean)) return null;
  if (/^profile\.php$/i.test(clean)) {
    const id = /(?:^|&)id=(\d+)/.exec(query)?.[1];
    return id ? `profile.php?id=${id}` : null;
  }
  // Usernames are case-insensitive; /people/Name/123 paths are kept as they are.
  return clean.includes('/') ? clean : clean.toLowerCase();
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

export function facebookUrl(page: string): string {
  return `https://www.facebook.com/${page}`;
}

export function socialUrl(platform: DmPlatform, value: string): string {
  return platform === 'instagram' ? instagramUrl(value) : facebookUrl(value);
}

/** How a contact shows on Facebook: "bloombakery", or "Facebook profile" for an id link. */
export function facebookLabel(page: string): string {
  return page.startsWith('profile.php') ? 'Facebook profile' : page;
}

/** A DM's details, or null if the metadata is missing or malformed. */
export function readDm(metadata: unknown): DmDetails | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const platform = DM_PLATFORMS.find((p) => p === m.platform);
  const direction = DM_DIRECTIONS.find((d) => d === m.direction);
  return platform && direction ? { platform, direction } : null;
}

/** "Instagram DM · I sent a DM" */
export function dmSummary(dm: DmDetails | null): string {
  if (!dm) return 'DM';
  return `${DM_PLATFORM_LABEL[dm.platform]} DM · ${DM_DIRECTION_LABEL[dm.direction]}`;
}
