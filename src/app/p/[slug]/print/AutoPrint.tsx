'use client';

import { useEffect } from 'react';

/**
 * Opens the browser's print dialog once the page is genuinely ready.
 *
 * Waiting on document.fonts.ready matters: Archivo Black sets the display
 * headings, and the oversized second line has to be measured in the real
 * face for the clip to land in the same place it does on screen. Printing
 * before the font swaps produces a different crop.
 *
 * Only runs when the URL asks for it, so the route can be opened for
 * inspection — or loaded by the PDF renderer — without a dialog.
 */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (cancelled) return;
      // One frame after fonts resolve, so layout has settled.
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}
