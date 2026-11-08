// The homepage photos chosen in admin (Website → Homepage), saved in
// admin_config under `home_collage`:
//   { mosaic: { desktop: [{ slug, src, col, row, w, h }], phone: [...] },
//     fan: [pick ×3], inline: [pick ×2], pages: { about, contact, book } }
// `mosaic` is the hero: its own tiles for desktop (6 columns) and phones (2),
// each placed where Lauren dragged it (src/lib/collageLayout.ts). `fan` is the three photos
// above the statement, `inline` the two inside "We're a … Full-Service …
// Creative Studio"; a null there means "pick automatically". `pages` holds
// the photo strips on other pages (About, Contact, Book a call), same rule:
// null = the automatic pick (mixedPhotos). Only case-study
// images can be chosen, so every photo is real client work with real alt
// text. Older saves (a plain array of seven picks, then `tiles` with named
// sizes) still read: they're packed into a desktop layout and a phone one made from it.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CASE_STUDIES, type CaseImage, type CaseStudy } from '@/app/work/caseStudies';
import { caseImageUrl } from './storage';
import { mixedPhotos, type WorkPhoto } from './workPhotos';
import { COLS, DEFAULT_DESKTOP, MAX_TILES, autoPhotos, canPlace, isTileSize, packOldSizes, phoneFrom, type Layout, type Rect, type TileSize } from './collageLayout';

export const COLLAGE_KEY = 'home_collage';
export const FAN_COUNT = 3;
export const INLINE_COUNT = 2;

export type CollagePick = { slug: string; src: string };
export type PlacedPick = CollagePick & Rect;
export type Mosaic = Record<Layout, PlacedPick[]>;
export type CollageTile = Rect & { slug: string; src: string; url: string; alt: string; title: string; href: string };
/** Photo strips on other pages: how many photos each shows. */
export const PAGE_STRIPS = { about: 5, contact: 3, book: 4 } as const;
export type StripPage = keyof typeof PAGE_STRIPS;
export const STRIP_PAGES = Object.keys(PAGE_STRIPS) as StripPage[];
export type HomeConfig = {
  mosaic: Mosaic;
  fan: (CollagePick | null)[];
  inline: (CollagePick | null)[];
  pages: Record<StripPage, (CollagePick | null)[]>;
};
export type HomePhotos = { collage: Record<Layout, CollageTile[]>; fan: string[]; inline: string[] };
export type LibraryProject = { slug: string; title: string; images: { src: string; url: string; alt: string }[] };

// Thrive's own social isn't client work.
const SKIP = new Set(['thrive-social-media-management-graphics-creation']);
const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

function imagesOf(cs: CaseStudy): CaseImage[] {
  const all: CaseImage[] = [
    ...(cs.heroImage ? [cs.heroImage] : []),
    ...(cs.showcase ?? []).flatMap((s) => s.images),
    ...(cs.pages ?? []).flatMap((pg) => [pg.desktop, ...(pg.mobile ? [pg.mobile] : [])]),
    ...(cs.design?.fullPages ?? []),
    ...(cs.mobile?.shots ?? []),
  ];
  const seen = new Set<string>();
  return all.filter((im) => !isVideo(im.src) && !seen.has(im.src) && seen.add(im.src));
}

/** Every case-study image, by project — what the admin picker offers. */
export function collageLibrary(): LibraryProject[] {
  return Object.values(CASE_STUDIES)
    .filter((cs) => !SKIP.has(cs.slug))
    .map((cs) => ({
      slug: cs.slug,
      title: cs.client,
      images: imagesOf(cs).map((im) => ({ src: im.src, url: caseImageUrl(im.src, 900), alt: im.alt })),
    }))
    .filter((p) => p.images.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function imageFor(pick: Partial<CollagePick> | null | undefined) {
  if (!pick || typeof pick.slug !== 'string' || typeof pick.src !== 'string') return null;
  const cs = CASE_STUDIES[pick.slug];
  if (!cs || SKIP.has(cs.slug)) return null;
  const im = imagesOf(cs).find((i) => i.src === pick.src);
  return im ? { cs, im } : null;
}

function tileFor(pick: PlacedPick): CollageTile | null {
  const found = imageFor(pick);
  if (!found) return null;
  const { cs, im } = found;
  return { slug: cs.slug, src: im.src, url: caseImageUrl(im.src, 1400), alt: im.alt, title: cs.client, href: `/work/${cs.slug}`, col: pick.col, row: pick.row, w: pick.w, h: pick.h };
}

/** Until something is chosen: one image per project, in this order. */
const DEFAULT_PICKS: CollagePick[] = [
  { slug: 'the-burrell-group', src: '/case-studies/the-burrell-group/mockup-screens.webp' },
  { slug: 'roots-to-wellness-social-media-management-graphics-creation', src: '/case-studies/roots-to-wellness-social-media-management-graphics-creation/post-fresh-harvest.webp' },
  { slug: 'soulcheck', src: '/case-studies/soulcheck/screens.webp' },
  { slug: 'dj-mastamind', src: '/case-studies/dj-mastamind/poster-mastamind.webp' },
  { slug: 'brewhaus', src: '/case-studies/brewhaus/bag-and-cup.webp' },
  { slug: 'classic-rollers-car-club', src: '/case-studies/classic-rollers-car-club/mockup-screens.webp' },
  { slug: 'dallas-derby-day', src: '/case-studies/dallas-derby-day/post-perfect-pair.webp' },
];

const withPhone = (desktop: PlacedPick[]): Mosaic => {
  const phone = phoneFrom(desktop);
  return { desktop, phone: desktop.map((p, i) => ({ slug: p.slug, src: p.src, ...phone[i] })) };
};
export const DEFAULT_MOSAIC: Mosaic = withPhone(DEFAULT_PICKS.map((p, i) => ({ ...p, ...DEFAULT_DESKTOP[i] })));

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : 0);

/** One layout's tiles, validated: real images, inside the grid, none overlapping. */
function parseLayout(v: unknown, layout: Layout): PlacedPick[] {
  const out: PlacedPick[] = [];
  for (const t of Array.isArray(v) ? v : []) {
    const pick = validPick(t);
    const o = (t ?? {}) as Record<string, unknown>;
    const rect = { col: int(o.col), row: int(o.row), w: int(o.w), h: int(o.h) };
    if (pick && out.length < MAX_TILES && canPlace(out, rect, COLS[layout])) out.push({ ...pick, ...rect });
  }
  return out;
}

/** Older saves: picks in order with named sizes, packed onto desktop. */
function fromOldTiles(list: { pick: CollagePick; size: TileSize }[]): Mosaic {
  const rects = packOldSizes(list.map((t) => t.size));
  return withPhone(rects.map((r, i) => ({ ...list[i].pick, ...r })));
}

const validPick = (p: unknown): CollagePick | null =>
  imageFor(p as Partial<CollagePick>) ? { slug: (p as CollagePick).slug, src: (p as CollagePick).src } : null;

/** A saved value, validated. Tiles whose image has since been removed are dropped. */
export function parseConfig(value: string | null | undefined): HomeConfig {
  let raw: unknown = null;
  try { raw = JSON.parse(value ?? 'null'); } catch { raw = null; }
  const obj = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as {
    mosaic?: Partial<Record<Layout, unknown>>; tiles?: unknown; fan?: unknown; inline?: unknown; pages?: Record<string, unknown>;
  };
  let mosaic: Mosaic | null = null;
  if (obj.mosaic) {
    const desktop = parseLayout(obj.mosaic.desktop, 'desktop');
    const phone = parseLayout(obj.mosaic.phone, 'phone');
    if (desktop.length) mosaic = phone.length ? { desktop, phone } : withPhone(desktop);
  } else {
    // Before free placement: `tiles` with named sizes, or (first) a plain array of seven picks.
    const old = Array.isArray(raw)
      ? (raw as unknown[]).slice(0, 7).map((p, i) => ({ pick: validPick(p) ?? DEFAULT_PICKS[i], size: (['big', 'wide', 'big', 'tall', 'tall', 'wide', 'wide'] as TileSize[])[i] }))
      : (Array.isArray(obj.tiles) ? obj.tiles : []).flatMap((t) => {
          const pick = validPick(t);
          const size = (t as { size?: unknown })?.size;
          return pick && isTileSize(size) ? [{ pick, size }] : [];
        });
    if (old.length) mosaic = fromOldTiles(old.slice(0, MAX_TILES));
  }
  const list = (v: unknown, n: number) => Array.from({ length: n }, (_, i) => validPick(Array.isArray(v) ? v[i] : null));
  const pages = Object.fromEntries(STRIP_PAGES.map((k) => [k, list(obj.pages?.[k], PAGE_STRIPS[k])])) as HomeConfig['pages'];
  return { mosaic: mosaic ?? DEFAULT_MOSAIC, fan: list(obj.fan, FAN_COUNT), inline: list(obj.inline, INLINE_COUNT), pages };
}

export async function loadConfig(db: SupabaseClient): Promise<HomeConfig> {
  const { data } = await db.from('admin_config').select('value').eq('key', COLLAGE_KEY).maybeSingle();
  return parseConfig(data?.value);
}

/** Every photo the homepage shows: the mosaic, then the statement and heading photos. */
export function photosFor(config: HomeConfig): HomePhotos {
  // In reading order, so the tiles fade in left to right, top to bottom.
  const tiles = (layout: Layout) => config.mosaic[layout].map(tileFor).filter((t): t is CollageTile => Boolean(t))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const collage = { desktop: tiles('desktop'), phone: tiles('phone') };
  const auto = autoPhotos(collage.desktop.map((t) => t.href), FAN_COUNT + INLINE_COUNT);
  const url = (p: CollagePick | null, fallback: string) => {
    const found = imageFor(p);
    return found ? caseImageUrl(found.im.src, 900) : fallback;
  };
  return {
    collage,
    fan: config.fan.map((p, i) => url(p, auto[i])),
    inline: config.inline.map((p, i) => url(p, auto[FAN_COUNT + i])),
  };
}

export async function loadHomePhotos(db: SupabaseClient | null): Promise<HomePhotos> {
  const config = db ? await loadConfig(db).catch(() => parseConfig(null)) : parseConfig(null);
  return photosFor(config);
}

/** A page's photo strip: chosen photos, automatic ones where nothing is chosen. */
export function stripPhotos(config: HomeConfig, page: StripPage): WorkPhoto[] {
  const auto = mixedPhotos(PAGE_STRIPS[page]);
  return config.pages[page].map((pk, i) => {
    const found = imageFor(pk);
    if (!found) return auto[i % auto.length];
    const { cs, im } = found;
    return { src: caseImageUrl(im.src, 900), alt: im.alt, caption: cs.client, href: `/work/${cs.slug}` };
  });
}

export async function loadStripPhotos(db: SupabaseClient | null, page: StripPage): Promise<WorkPhoto[]> {
  const config = db ? await loadConfig(db).catch(() => parseConfig(null)) : parseConfig(null);
  return stripPhotos(config, page);
}

export async function saveConfig(db: SupabaseClient, config: HomeConfig) {
  const clean = parseConfig(JSON.stringify(config));
  const value = JSON.stringify(clean);
  const now = new Date().toISOString();
  // admin_config predates the migrations (no unique key to upsert on).
  const { data: existing } = await db.from('admin_config').select('key').eq('key', COLLAGE_KEY).maybeSingle();
  const { error } = existing
    ? await db.from('admin_config').update({ value, updated_at: now }).eq('key', COLLAGE_KEY)
    : await db.from('admin_config').insert({ key: COLLAGE_KEY, value, updated_at: now });
  if (error) throw new Error(error.message);
  return clean;
}
