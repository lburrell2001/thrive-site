'use client';

// A draft's (or locked final's) watermarked preview (073). The picture is
// fetched with the client's token and painted into a canvas, so there's no
// image link to open, save or share, and a transparent layer over it eats
// right-click, long-press and drag. It blanks while a screenshot shortcut is
// held (⌘⇧ on a Mac, Print Screen, Win+Shift), when the window loses focus or
// the tab is hidden, and when printing. No website can stop a phone screenshot
// or a camera — that's what the watermark with their name is for.

import { useEffect, useRef, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

function useShield() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = (ms?: number) => {
      setHidden(true);
      if (timer) clearTimeout(timer);
      if (ms) timer = setTimeout(() => setHidden(false), ms);
    };
    const show = () => { if (timer) clearTimeout(timer); setHidden(false); };
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'PrintScreen') {
        hide(1500);
        navigator.clipboard?.writeText('').catch(() => undefined);
        return;
      }
      // ⌘⇧3/4/5 on a Mac, Win+Shift+S / Ctrl+Shift on Windows: blank as soon as the chord starts.
      if ((e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey) || ((e.metaKey || e.ctrlKey) && /^[ps]$/i.test(k))) {
        hide();
        if ((e.metaKey || e.ctrlKey) && /^[ps]$/i.test(k)) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') return;
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) setTimeout(show, 400);
    };
    const vis = () => (document.visibilityState === 'hidden' ? hide() : show());
    const blur = () => hide();
    const focus = () => setTimeout(show, 200);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', vis);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return hidden;
}

const block = (e: React.SyntheticEvent) => e.preventDefault();

export default function ProtectedPreview({ fileId, label, maxHeight = 420 }: { fileId: string; label: string; maxHeight?: number | string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const hidden = useShield();

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const { data: { session } } = await supabasePortal.auth.getSession();
        if (!session) throw new Error('signed out');
        const res = await fetch(`/api/portal/files/${fileId}/preview`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const bitmap = await createImageBitmap(await res.blob());
        const c = canvas.current;
        if (gone || !c) { bitmap.close(); return; }
        c.width = bitmap.width; c.height = bitmap.height;
        c.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.close();
        setState('ready');
      } catch {
        if (!gone) setState('error');
      }
    })();
    return () => { gone = true; };
  }, [fileId]);

  return (
    <div
      className="tcs-protected"
      onContextMenu={block} onDragStart={block} onCopy={block} onCut={block}
      style={{ position: 'relative', background: '#f2f2f2', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
    >
      <style>{'@media print { .tcs-protected { display: none !important; } }'}</style>
      <canvas
        ref={canvas}
        aria-label={`${label} (watermarked preview)`}
        role="img"
        style={{ display: 'block', maxWidth: '100%', maxHeight, width: 'auto', height: 'auto', visibility: hidden || state !== 'ready' ? 'hidden' : 'visible', filter: hidden ? 'blur(24px)' : 'none' }}
      />
      {/* Sits over the picture so right-click, long-press and drag never reach it. */}
      <div aria-hidden onContextMenu={block} onMouseDown={block} onTouchStart={() => undefined} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
      {(state !== 'ready' || hidden) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 600, color: '#808080' }}>
          {state === 'loading' ? 'Loading preview…' : state === 'error' ? 'The preview could not load. Refresh to try again.' : 'Preview hidden'}
        </div>
      )}
    </div>
  );
}
