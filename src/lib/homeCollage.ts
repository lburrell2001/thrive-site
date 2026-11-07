// The homepage photos chosen in admin (Website → Homepage), saved in
// admin_config under `home_collage`:
//   { tiles: [{ slug, src, size }], fan: [pick ×3], inline: [pick ×2] }
// `tiles` is the hero mosaic in order, any number from 1 to MAX_TILES, each
// with a size (layout in src/lib/collageLayout.ts). `fan` is the three photos
// above the statement, `inline` the two inside "We're a … Full-Service …
// Creative Studio"; a null there means "pick automatically". Only case-study
// images can be chosen, so every photo is real client work with real alt
// text. Older saves were a plain array of seven picks; they still read.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CASE_STUDIES, type CaseImage, type CaseStudy } from '@/app/work/caseStudies';
import { caseImageUrl } from './storage';
import { DEFAULT_SIZES_LIST, MAX_TILES, autoPhotos, isTileSize, type TileSize } from './collageLayout';

export const COLLAGE_KEY = 'home_collage';
export const FAN_COUNT = 3;
export const INLINE_COUNT = 2;

export type CollagePick = { slug: string; src: string };
export type TilePick = CollagePick & { size: TileSize };
export type CollageTile = { slug: string; src: string; url: string; alt: string; title: string; href: string; size: TileSize };
export type HomeConfig = { tiles: TilePick[]; fan: (CollagePick | null)[]; inline: (CollagePick | null)[] };
export type HomePhotos = { collage: CollageTile[]; fan: string[]; inline: string[] };
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

function tileFor(pick: TilePick): CollageTile | null {
  const found = imageFor(pick);
  if (!found) return null;
  const { cs, im } = found;
  return { slug: cs.slug, src: im.src, url: caseImageUrl(im.src, 1400), alt: im.alt, title: cs.client, href: `/work/${cs.slug}`, size: pick.size };
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

export const DEFAULT_TILES: TilePick[] = DEFAULT_PICKS.map((p, i) => ({ ...p, size: DEFAULT_SIZES_LIST[i] }));

const validPick = (p: unknown): CollagePick | null =>
  imageFor(p as Partial<CollagePick>) ? { slug: (p as CollagePick).slug, src: (p as CollagePick).src } : null;

/** A saved value, validated. Tiles whose image has since been removed are dropped. */
export function parseConfig(value: string | null | undefined): HomeConfig {
  let raw: unknown = null;
  try { raw = JSON.parse(value ?? 'null'); } catch { raw = null; }
  // Before tile sizes: an array of seven picks (null = the default for that tile).
  if (Array.isArray(raw)) {
    raw = { tiles: DEFAULT_TILES.map((d, i) => ({ ...(validPick(raw && (raw as unknown[])[i]) ?? d), size: d.size })) };
  }
  const obj = (raw && typeof raw === 'object' ? raw : {}) as { tiles?: unknown; fan?: unknown; inline?: unknown };
  const tiles = (Array.isArray(obj.tiles) ? obj.tiles : [])
    .map((t) => {
      const pick = validPick(t);
      const size = (t as { size?: unknown })?.size;
      return pick && isTileSize(size) ? { ...pick, size } : null;
    })
    .filter((t): t is TilePick => Boolean(t))
    .slice(0, MAX_TILES);
  const list = (v: unknown, n: number) => Array.from({ length: n }, (_, i) => validPick(Array.isArray(v) ? v[i] : null));
  return { tiles: tiles.length ? tiles : DEFAULT_TILES, fan: list(obj.fan, FAN_COUNT), inline: list(obj.inline, INLINE_COUNT) };
}

export async function loadConfig(db: SupabaseClient): Promise<HomeConfig> {
  const { data } = await db.from('admin_config').select('value').eq('key', COLLAGE_KEY).maybeSingle();
  return parseConfig(data?.value);
}

/** Every photo the homepage shows: the mosaic, then the statement and heading photos. */
export function photosFor(config: HomeConfig): HomePhotos {
  const collage = config.tiles.map(tileFor).filter((t): t is CollageTile => Boolean(t));
  const auto = autoPhotos(collage.map((t) => t.href), FAN_COUNT + INLINE_COUNT);
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
