// The homepage hero mosaic's layout, shared by the homepage and the admin
// editor (Website → Homepage) so the preview is exactly what the site shows.
// Each tile has a size; tiles are packed in order, each into the first spot it
// fits (like CSS grid's dense flow), on 6 columns on desktop and 2 on phones
// (where Big tiles are one column by two rows, the rest one cell, and a tile
// with an empty space beside it stretches across).
// Pure — no server imports — so the admin page can run it in the browser.

import { WORK_PHOTOS, type WorkPhoto } from './workPhotos';

export type TileSize = 'big' | 'wide' | 'tall' | 'small';

/** Columns × rows a tile covers, on desktop and on phones. */
export const TILE_SIZES: Record<TileSize, { label: string; w: number; h: number; mw: number; mh: number }> = {
  big: { label: 'Big', w: 2, h: 2, mw: 1, mh: 2 },
  wide: { label: 'Wide', w: 2, h: 1, mw: 1, mh: 1 },
  tall: { label: 'Tall', w: 1, h: 2, mw: 1, mh: 1 },
  small: { label: 'Small', w: 1, h: 1, mw: 1, mh: 1 },
};
/** The original seven-tile layout, the default. */
export const DEFAULT_SIZES_LIST: TileSize[] = ['big', 'wide', 'big', 'tall', 'tall', 'wide', 'wide'];
export const SIZE_ORDER: TileSize[] = ['big', 'wide', 'tall', 'small'];
export const isTileSize = (v: unknown): v is TileSize => typeof v === 'string' && v in TILE_SIZES;

export const DESKTOP_COLS = 6;
export const PHONE_COLS = 2;
export const MAX_TILES = 16;

export type Placement = { col: number; row: number; w: number; h: number };

/** Place each tile in the first spot it fits. Rows/cols are 1-based for CSS grid. */
export function packTiles(sizes: TileSize[], cols: number) {
  const grid: boolean[][] = [];
  const free = (r: number, c: number) => !grid[r]?.[c];
  const places: Placement[] = sizes.map((size) => {
    const t = TILE_SIZES[size];
    const w = Math.min(cols === PHONE_COLS ? t.mw : t.w, cols);
    const h = cols === PHONE_COLS ? t.mh : t.h;
    for (let r = 0; ; r++) {
      for (let c = 0; c + w <= cols; c++) {
        let fits = true;
        for (let dr = 0; dr < h && fits; dr++) for (let dc = 0; dc < w && fits; dc++) fits = free(r + dr, c + dc);
        if (!fits) continue;
        for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) (grid[r + dr] ??= [])[c + dc] = true;
        return { col: c + 1, row: r + 1, w, h };
      }
    }
  });
  // Phones: a tile with nothing beside it (e.g. the last one) stretches across the row.
  if (cols === PHONE_COLS) {
    places.forEach((pl) => {
      if (pl.w >= cols) return;
      const r0 = pl.row - 1;
      for (let c = 0; c < cols; c++) {
        if (c >= pl.col - 1 && c < pl.col - 1 + pl.w) continue;
        for (let dr = 0; dr < pl.h; dr++) if (!free(r0 + dr, c)) return;
      }
      for (let dr = 0; dr < pl.h; dr++) for (let c = 0; c < cols; c++) (grid[r0 + dr] ??= [])[c] = true;
      pl.col = 1; pl.w = cols;
    });
  }
  const rows = grid.length;
  let gaps = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!grid[r]?.[c]) gaps++;
  return { places, rows, gaps };
}

/** The CSS variables a tile needs to sit in its spot on both layouts. */
export function tileStyleVars(sizes: TileSize[]) {
  const desk = packTiles(sizes, DESKTOP_COLS).places;
  const phone = packTiles(sizes, PHONE_COLS).places;
  return sizes.map((_, i) => ({
    '--c': desk[i].col, '--r': desk[i].row, '--w': desk[i].w, '--h': desk[i].h,
    '--mc': phone[i].col, '--mr': phone[i].row, '--mw': phone[i].w, '--mh': phone[i].h,
  }));
}

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
