// The homepage hero collage: seven project photos, chosen in admin
// (Website → Homepage) and saved in admin_config under `home_collage` as
// [{ slug, src }] — one per tile, in tile order a–g. Only images from the
// case studies can be chosen, so every tile is real client work with real
// alt text, and links to its case study. With nothing saved (or a saved image
// that's since been removed) the tile falls back to the default pick.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CASE_STUDIES, type CaseImage, type CaseStudy } from '@/app/work/caseStudies';
import { caseImageUrl } from './storage';

export const COLLAGE_KEY = 'home_collage';
export const COLLAGE_SLOTS = 7;
/** What each tile looks like on desktop, for the admin picker. */
export const SLOT_SHAPES = ['Big', 'Wide', 'Tall', 'Tall', 'Tall', 'Wide', 'Wide'] as const;

export type CollagePick = { slug: string; src: string };
export type CollageTile = { slug: string; src: string; url: string; alt: string; title: string; href: string };
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

function tileFor(pick: CollagePick): CollageTile | null {
  const cs = CASE_STUDIES[pick.slug];
  if (!cs || SKIP.has(cs.slug)) return null;
  const im = imagesOf(cs).find((i) => i.src === pick.src);
  if (!im) return null;
  return { slug: cs.slug, src: im.src, url: caseImageUrl(im.src, 1400), alt: im.alt, title: cs.client, href: `/work/${cs.slug}` };
}

/** Until something is chosen: one image per project, in this order. */
const DEFAULT: CollagePick[] = [
  { slug: 'the-burrell-group', src: '/case-studies/the-burrell-group/mockup-screens.webp' },
  { slug: 'roots-to-wellness-social-media-management-graphics-creation', src: '/case-studies/roots-to-wellness-social-media-management-graphics-creation/post-fresh-harvest.webp' },
  { slug: 'soulcheck', src: '/case-studies/soulcheck/screens.webp' },
  { slug: 'dj-mastamind', src: '/case-studies/dj-mastamind/poster-mastamind.webp' },
  { slug: 'brewhaus', src: '/case-studies/brewhaus/bag-and-cup.webp' },
  { slug: 'classic-rollers-car-club', src: '/case-studies/classic-rollers-car-club/mockup-screens.webp' },
  { slug: 'dallas-derby-day', src: '/case-studies/dallas-derby-day/post-perfect-pair.webp' },
];

/** The saved picks (validated), padded to seven. */
export function parsePicks(value: string | null | undefined): (CollagePick | null)[] {
  let raw: unknown = [];
  try { raw = JSON.parse(value ?? '[]'); } catch { raw = []; }
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: COLLAGE_SLOTS }, (_, i) => {
    const p = list[i] as Partial<CollagePick> | null | undefined;
    return p && typeof p.slug === 'string' && typeof p.src === 'string' && tileFor(p as CollagePick) ? { slug: p.slug, src: p.src } : null;
  });
}

export async function loadPicks(db: SupabaseClient): Promise<(CollagePick | null)[]> {
  const { data } = await db.from('admin_config').select('value').eq('key', COLLAGE_KEY).maybeSingle();
  return parsePicks(data?.value);
}

/** The seven tiles for the homepage: saved picks, defaults where a tile is empty. */
export async function loadCollage(db: SupabaseClient | null): Promise<CollageTile[]> {
  const picks = db ? await loadPicks(db).catch(() => []) : [];
  return Array.from({ length: COLLAGE_SLOTS }, (_, i) => tileFor(picks[i] ?? DEFAULT[i]) ?? tileFor(DEFAULT[i]))
    .filter((t): t is CollageTile => Boolean(t));
}

export async function savePicks(db: SupabaseClient, picks: (CollagePick | null)[]) {
  const clean = parsePicks(JSON.stringify(picks));
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
