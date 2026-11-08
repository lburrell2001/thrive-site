// The homepage hero mosaic's layout, shared by the homepage and the admin
// editor (Website → Homepage). Desktop and phones each have their own layout:
// a list of tiles placed on a grid (6 columns on desktop, 2 on phones), each
// at a column and row with a width and height in cells. Lauren drags tiles
// into place and resizes them in admin; the homepage draws exactly that.
// Pure — no server imports — so the admin page runs it in the browser.

import { WORK_PHOTOS, type WorkPhoto } from './workPhotos';

export type Rect = { col: number; row: number; w: number; h: number };
export type Layout = 'desktop' | 'phone';

export const COLS: Record<Layout, number> = { desktop: 6, phone: 2 };
export const MAX_TILE_H = 4;
export const MAX_ROWS = 14;
export const MAX_TILES = 20;

/** Quick sizes offered in admin (width × height in cells), per layout. */
export const PRESETS: Record<Layout, { label: string; w: number; h: number }[]> = {
  desktop: [
    { label: 'Small', w: 1, h: 1 }, { label: 'Wide', w: 2, h: 1 }, { label: 'Tall', w: 1, h: 2 },
    { label: 'Big', w: 2, h: 2 }, { label: 'Large', w: 3, h: 2 }, { label: 'Banner', w: 3, h: 1 },
    { label: 'Hero', w: 4, h: 2 }, { label: 'Full width', w: 6, h: 1 },
  ],
  phone: [
    { label: 'Small', w: 1, h: 1 }, { label: 'Tall', w: 1, h: 2 }, { label: 'Wide', w: 2, h: 1 }, { label: 'Big', w: 2, h: 2 },
  ],
};

const overlaps = (a: Rect, b: Rect) =>
  a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;

/** Whether `r` sits inside the grid without covering another tile (skipping index `ignore`). */
export function canPlace(rects: Rect[], r: Rect, cols: number, ignore = -1) {
  if (r.col < 1 || r.row < 1 || r.w < 1 || r.h < 1 || r.col + r.w - 1 > cols || r.h > MAX_TILE_H || r.row + r.h - 1 > MAX_ROWS) return false;
  return rects.every((o, i) => i === ignore || !overlaps(o, r));
}

/** Rows the layout covers. */
export const rowsOf = (rects: Rect[]) => rects.reduce((m, r) => Math.max(m, r.row + r.h - 1), 0);

/** Empty cells inside the rows the layout covers (they show as blank space). */
export function emptyCells(rects: Rect[], cols: number) {
  const area = rects.reduce((n, r) => n + r.w * r.h, 0);
  return rowsOf(rects) * cols - area;
}

/** The first spot a w×h tile fits, scanning row by row. */
export function firstFree(rects: Rect[], w: number, h: number, cols: number): Rect | null {
  for (let row = 1; row <= MAX_ROWS; row++) {
    for (let col = 1; col + w - 1 <= cols; col++) {
      const r = { col, row, w, h };
      if (canPlace(rects, r, cols)) return r;
    }
  }
  return null;
}

/** Place tiles of these sizes in order, each into the first spot it fits. */
export function pack(dims: { w: number; h: number }[], cols: number): Rect[] {
  const out: Rect[] = [];
  for (const d of dims) {
    const r = firstFree(out, Math.min(d.w, cols), Math.min(d.h, MAX_TILE_H), cols) ?? firstFree(out, 1, 1, cols);
    if (r) out.push(r);
  }
  return out;
}

/** A phone layout from a desktop one: same tiles in reading order, sized down, gaps filled. */
export function phoneFrom(desktop: Rect[]): Rect[] {
  const order = desktop.map((r, i) => ({ r, i })).sort((a, b) => a.r.row - b.r.row || a.r.col - b.r.col);
  const placed = pack(order.map(({ r }) => ({ w: r.w >= 4 ? 2 : 1, h: r.h >= 2 && r.w >= 2 ? 2 : 1 })), COLS.phone);
  // A tile with nothing beside it stretches across.
  placed.forEach((p, k) => {
    if (p.w === 1 && canPlace(placed, { ...p, col: 1, w: 2 }, COLS.phone, k)) { p.col = 1; p.w = 2; }
  });
  const out: Rect[] = new Array(desktop.length);
  order.forEach(({ i }, k) => { out[i] = placed[k]; });
  return out;
}

/** The CSS variables that put a tile in its spot. */
export const rectVars = (r: Rect) => ({ '--c': r.col, '--r': r.row, '--w': r.w, '--h': r.h });

/** The original seven-tile layout, the default. */
export const DEFAULT_DESKTOP: Rect[] = [
  { col: 1, row: 1, w: 2, h: 2 }, { col: 3, row: 1, w: 2, h: 1 }, { col: 5, row: 1, w: 2, h: 2 },
  { col: 3, row: 2, w: 1, h: 2 }, { col: 4, row: 2, w: 1, h: 2 }, { col: 1, row: 3, w: 2, h: 1 }, { col: 5, row: 3, w: 2, h: 1 },
];

// ---- older saves: tiles in order with a named size, packed automatically
export type TileSize = 'big' | 'wide' | 'tall' | 'small';
const OLD_SIZES: Record<TileSize, { w: number; h: number }> = { big: { w: 2, h: 2 }, wide: { w: 2, h: 1 }, tall: { w: 1, h: 2 }, small: { w: 1, h: 1 } };
export const isTileSize = (v: unknown): v is TileSize => typeof v === 'string' && v in OLD_SIZES;
export const packOldSizes = (sizes: TileSize[]) => pack(sizes.map((s) => OLD_SIZES[s]), COLS.desktop);

// ---- photos further down the homepage

// One real photo per client project (never Thrive's own social), taken a
// service at a time so neighbouring photos show different kinds of work.
const PHOTOS: WorkPhoto[] = (() => {
  const groups = Object.values(WORK_PHOTOS);
  const out: WorkPhoto[] = [];
  for (let i = 0; groups.some((g) => i < g.length); i++) {
    for (const g of groups) {
      const p = g[i];
      if (p && !p.href.includes('/work/thrive-') && !out.some((q) => q.href === p.href)) out.push(p);
    }
  }
  return out;
})();

/** When a statement or heading photo isn't chosen: projects not already in the mosaic. */
export function autoPhotos(collageHrefs: string[], count: number): string[] {
  const rest = PHOTOS.filter((p) => !collageHrefs.includes(p.href));
  const pool = rest.length >= count ? rest : PHOTOS;
  return Array.from({ length: count }, (_, i) => pool[i % pool.length].src);
}
