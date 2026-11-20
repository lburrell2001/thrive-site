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

/** A delivered file as the portal gets it from /api/portal/documents (073). */
export type ViewFile = {
  id: string; name: string; project_name?: string;
  /** Null while it's a draft or locked until an invoice is paid. */
  file_url: string | null;
  locked?: 'draft' | 'unpaid' | null;
  has_preview?: boolean;
  unlock_invoice?: { id: string; invoice_number: string } | null;
};

const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const FONT = 'var(--font-inter), Inter, sans-serif';

/** A signed storage link that downloads under the file's own name. */
export function downloadUrl(f: ViewFile): string | null {
  if (!f.file_url) return null;
  if (!/\/storage\/v1\/object\/sign\//.test(f.file_url)) return f.file_url;
  return `${f.file_url}${f.file_url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}`;
}

/** Badge text for a file: Draft, Final · Locked or Final. */
export function fileBadge(f: ViewFile): { text: string; bg: string; color: string } {
  if (f.locked === 'draft') return { text: 'Draft', bg: '#fd6100', color: '#fff' };
  if (f.locked === 'unpaid') return { text: 'Final · Locked', bg: '#e50586', color: '#fff' };
  return { text: 'Final', bg: '#0cf574', color: '#0a0a0a' };
}

/**
 * Opens a file full screen. Drafts and locked finals show only the protected,
 * watermarked preview; a final file shows the real thing with Download.
 */
export function FileViewer({ file, onClose }: { file: ViewFile; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const badge = fileBadge(file);
  const dl = downloadUrl(file);
  const pill: React.CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 700, borderRadius: 999, padding: '9px 20px', textDecoration: 'none', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' };

  return (
    <div role="dialog" aria-modal="true" aria-label={file.name} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,10,10,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 1100px)', display: 'flex', justifyContent: 'center' }}>
        {file.locked ? (
          file.has_preview
            ? <div style={{ width: '100%' }}><ProtectedPreview fileId={file.id} label={file.name} maxHeight="72vh" /></div>
            : <div style={{ background: '#1f1f1f', color: '#bfbfbf', borderRadius: 12, padding: 40, fontFamily: FONT, fontSize: 14, textAlign: 'center' }}>No preview for this file type.</div>
        ) : dl && IMAGE.test(file.name) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.file_url ?? ''} alt={file.name} style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', borderRadius: 12, background: '#f2f2f2' }} />
        ) : (
          <div style={{ background: '#1f1f1f', color: '#fff', borderRadius: 12, padding: 40, fontFamily: FONT, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>{file.name}</div>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center', maxWidth: 'min(100%, 1100px)' }}>
        <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>{file.name}</span>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.text}</span>
      </div>
      {file.locked && (
        <p onClick={(e) => e.stopPropagation()} style={{ fontFamily: FONT, fontSize: 13, color: '#bfbfbf', margin: 0, textAlign: 'center', maxWidth: 520, lineHeight: 1.5 }}>
          {file.locked === 'draft'
            ? 'This is a draft for your review. It’s watermarked and can’t be downloaded; the final files come once it’s approved and paid for.'
            : `Unlocks when ${file.unlock_invoice?.invoice_number ?? 'your invoice'} is paid in full. You’ll get an email the moment it’s ready to download.`}
        </p>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!file.locked && dl && <a href={dl} style={{ ...pill, background: '#e50586', color: '#fff' }}>Download</a>}
        {file.locked === 'unpaid' && <a href="/portal/invoices" style={{ ...pill, background: '#e50586', color: '#fff' }}>Pay Invoice</a>}
        <button type="button" onClick={onClose} style={{ ...pill, background: '#fff', color: '#0a0a0a' }}>Close</button>
      </div>
    </div>
  );
}
