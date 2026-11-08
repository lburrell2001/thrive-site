'use client';

// The hero mosaic editor: a grid (6 columns on desktop, 2 on phones) where
// each tile can be dragged to any spot, resized from its corner, or dropped
// on a tile of the same size to swap. Clicking an empty cell starts a new tile
// there. Arrow keys move the selected tile; Shift+arrows resize it.
// Placement rules live in src/lib/collageLayout.ts, shared with the homepage.

import { useEffect, useRef, useState } from 'react';
import { COLS, MAX_ROWS, MAX_TILE_H, canPlace, rowsOf, type Layout, type Rect } from '@/lib/collageLayout';
import s from './homepage.module.css';

export type EditorTile = Rect & { key: string; url?: string; label: string };

type Drag = {
  i: number;
  mode: 'move' | 'resize';
  x: number;
  y: number;
  offCol: number;
  offRow: number;
  preview: Rect;
  moved: boolean;
};

const GAP = 8;
// Row height as a share of column width, close to the homepage's proportions.
const RATIO: Record<Layout, number> = { desktop: 0.9, phone: 0.74 };

export default function MosaicEditor({
  layout, tiles, selected, pending, onSelect, onChange, onEmptyCell,
}: {
  layout: Layout;
  tiles: EditorTile[];
  selected: number | null;
  /** The spot of a tile being added (waiting for a photo). */
  pending: Rect | null;
  onSelect: (i: number) => void;
  onChange: (rects: Rect[]) => void;
  onEmptyCell: (col: number, row: number) => void;
}) {
  const cols = COLS[layout];
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cellW = width > 0 ? (width - GAP * (cols - 1)) / cols : 100;
  const rowH = Math.round(cellW * RATIO[layout]);
  const rects: Rect[] = tiles.map(({ col, row, w, h }) => ({ col, row, w, h }));
  const all = pending ? [...rects, pending] : rects;
  const rows = Math.min(MAX_ROWS, Math.max(3, rowsOf(all) + 1, drag ? drag.preview.row + drag.preview.h : 0));

  function cellAt(clientX: number, clientY: number) {
    const box = ref.current!.getBoundingClientRect();
    const col = Math.floor((clientX - box.left + GAP / 2) / (cellW + GAP)) + 1;
    const row = Math.floor((clientY - box.top + GAP / 2) / (rowH + GAP)) + 1;
    return { col: Math.min(cols, Math.max(1, col)), row: Math.min(MAX_ROWS, Math.max(1, row)) };
  }

  /** Dropping onto a tile of the same size swaps the two. */
  function swapTarget(d: Drag) {
    if (d.mode !== 'move') return -1;
    const me = rects[d.i];
    return rects.findIndex((o, j) => j !== d.i && o.col === d.preview.col && o.row === d.preview.row && o.w === me.w && o.h === me.h);
  }

  function start(e: React.PointerEvent, i: number, mode: Drag['mode']) {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const at = cellAt(e.clientX, e.clientY);
    const r = rects[i];
    setDrag({ i, mode, x: e.clientX, y: e.clientY, offCol: at.col - r.col, offRow: at.row - r.row, preview: r, moved: false });
  }

  function move(e: React.PointerEvent) {
    if (!drag) return;
    const moved = drag.moved || Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5;
    const at = cellAt(e.clientX, e.clientY);
    const r = rects[drag.i];
    const preview = drag.mode === 'move'
      ? { ...r, col: Math.min(cols - r.w + 1, Math.max(1, at.col - drag.offCol)), row: Math.min(MAX_ROWS - r.h + 1, Math.max(1, at.row - drag.offRow)) }
      : { ...r, w: Math.min(cols - r.col + 1, Math.max(1, at.col - r.col + 1)), h: Math.min(MAX_TILE_H, Math.max(1, at.row - r.row + 1)) };
    setDrag({ ...drag, moved, preview });
  }

  function end() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) { onSelect(d.i); return; }
    if (canPlace(rects, d.preview, cols, d.i)) {
      onChange(rects.map((r, j) => (j === d.i ? d.preview : r)));
    } else {
      const j = swapTarget(d);
      if (j >= 0) onChange(rects.map((r, k) => (k === d.i ? rects[j] : k === j ? rects[d.i] : r)));
    }
    onSelect(d.i);
  }

  function key(e: React.KeyboardEvent, i: number) {
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = step[e.key];
    if (!dir) return;
    e.preventDefault();
    const r = rects[i];
    const next = e.shiftKey ? { ...r, w: r.w + dir[0], h: r.h + dir[1] } : { ...r, col: r.col + dir[0], row: r.row + dir[1] };
    if (canPlace(rects, next, cols, i)) onChange(rects.map((x, j) => (j === i ? next : x)));
  }

  const place = (r: Rect): React.CSSProperties => ({ gridColumn: `${r.col} / span ${r.w}`, gridRow: `${r.row} / span ${r.h}` });
  const valid = drag ? canPlace(rects, drag.preview, cols, drag.i) || swapTarget(drag) >= 0 : true;

  // Empty cells to click (and to see where things can go).
  const taken = new Set<string>();
  all.forEach((r) => { for (let y = r.row; y < r.row + r.h; y++) for (let x = r.col; x < r.col + r.w; x++) taken.add(`${x},${y}`); });

  return (
    <div
      ref={ref}
      className={`${s.editor} ${layout === 'phone' ? s.editorPhone : ''} ${drag ? s.editorDragging : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: `${rowH}px`, gap: GAP }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
    >
      {Array.from({ length: rows * cols }, (_, k) => {
        const col = (k % cols) + 1;
        const row = Math.floor(k / cols) + 1;
        if (taken.has(`${col},${row}`)) return null;
        return (
          <button key={`c${col},${row}`} type="button" className={s.cell} style={place({ col, row, w: 1, h: 1 })}
            onClick={() => onEmptyCell(col, row)} aria-label={`Add a tile at column ${col}, row ${row}`}>
            <span>+</span>
          </button>
        );
      })}

      {tiles.map((t, i) => {
        const dragging = drag?.i === i && drag.moved;
        return (
          <div
            key={t.key}
            role="button"
            tabIndex={0}
            className={`${s.mTile} ${selected === i ? s.mTileOn : ''} ${dragging ? s.mTileGhost : ''}`}
            style={place(t)}
            onPointerDown={(e) => start(e, i, 'move')}
            onKeyDown={(e) => key(e, i)}
            onFocus={() => { if (!drag) onSelect(i); }}
            aria-label={`${t.label}, ${t.w} by ${t.h}. Drag to move, drag the corner to resize, or use the arrow keys (Shift to resize).`}
          >
            {t.url && <img src={t.url} alt="" draggable={false} />}
            <span className={s.mLabel}>{t.label} · {t.w}×{t.h}</span>
            <span className={s.handle} onPointerDown={(e) => start(e, i, 'resize')} title="Drag to resize" aria-hidden />
          </div>
        );
      })}

      {pending && (
        <div className={`${s.mTile} ${s.mTileOn} ${s.mTileNew}`} style={place(pending)}>
          <span>Pick a photo below</span>
        </div>
      )}

      {drag?.moved && (
        <div className={`${s.preview} ${valid ? '' : s.previewBad}`} style={place(drag.preview)} aria-hidden>
          {tiles[drag.i]?.url && <img src={tiles[drag.i].url} alt="" draggable={false} />}
        </div>
      )}
    </div>
  );
}
