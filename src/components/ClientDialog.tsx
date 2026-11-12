"use client";

// The client dialogs on proposal and estimate pages (Approve / Accept, Not
// going ahead): a light, rounded
// card over a dimmed page. Portalled to the body — the sticky footer has a
// backdrop-filter, which would otherwise trap a fixed overlay inside it.
// Escape closes (unless `locked`), Tab stays inside, focus returns on close.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function ClientDialog({
  open,
  onClose,
  labelledBy,
  locked = false,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  /** While sending: no closing by Escape or the backdrop. */
  locked?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const first = card.current?.querySelector<HTMLElement>("input, textarea, button:not([disabled])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) { onClose(); return; }
      if (e.key !== "Tab" || !card.current) return;
      const items = card.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea, select");
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      before?.focus?.();
    };
  }, [open, locked, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="pdOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div ref={card} className={`pdCard${wide ? " pdCardWide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button type="button" className="pdClose" aria-label="Close" onClick={onClose} disabled={locked}>×</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
