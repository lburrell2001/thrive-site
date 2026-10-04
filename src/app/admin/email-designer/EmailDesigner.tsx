'use client';

// The email designer: add sections on the left, edit the email itself in
// the middle, fine-tune the selected section (or the whole email's style)
// on the right.
//
// The canvas is the real email HTML (renderSections in editing mode)
// written into an iframe, so what you design is what gets sent. Words are
// typed straight into it; those keystrokes update the blocks without
// rewriting the iframe, so the cursor never jumps. Everything else
// (panel edits, undo, adding sections) rewrites it.

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import d from './designer.module.css';
import { renderNewsletter } from '@/lib/newsletterEmail';
import {
  BLOCK_HINT,
  BLOCK_LABEL,
  SECTION_GROUPS,
  applyTheme,
  newBlock,
  newSection,
  type BlockType,
  type NewsletterBlock,
  type NewsletterDesign,
  type Theme,
} from '@/lib/newsletterBlocks';
import { SectionInspector, StylePanel } from './Inspector';
import { uploadEmailImage, type Notify } from './fields';

type Snapshot = { blocks: NewsletterBlock[]; design: NewsletterDesign };

/** What the canvas's listeners need, always current. */
interface Live {
  blocks: NewsletterBlock[];
  selected: string | null;
  type: (id: string, path: string, value: string) => void;
  select: (id: string | null) => void;
  upload: (id: string, path: string, file: File) => void;
  travel: (dir: 'undo' | 'redo') => void;
  remove: () => void;
}

const noop = () => {};

/** Fields where Enter makes a new line; everywhere else it does nothing. */
const MULTILINE = /(^|\.)(headline|text|heading|tagline)$/;

function setIn(obj: unknown, keys: string[], value: unknown): unknown {
  if (!keys.length) return value;
  const [k, ...rest] = keys;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[Number(k)] = setIn(copy[Number(k)], rest, value);
    return copy;
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  return { ...o, [k]: setIn(o[k], rest, value) };
}

/**
 * The words in a canvas field as typed. Not innerText: that applies CSS,
 * so a capitalised headline would be saved in capitals.
 */
function fieldText(el: Node): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += (n as Text).data;
    else if (n.nodeName === 'BR') out += '\n';
    else {
      const t = fieldText(n);
      out += /^(DIV|P)$/.test(n.nodeName) && out ? `\n${t}` : t;
    }
  });
  return out;
}

function getIn(obj: unknown, keys: string[]): unknown {
  return keys.reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** A first line of a block's words, for the layers list. */
function snippet(b: NewsletterBlock): string {
  const s = (() => {
    switch (b.type) {
      case 'hero': case 'cta': return b.headline;
      case 'gallery': case 'features': return b.heading;
      case 'quote': return b.text;
      case 'heading': return b.text;
      case 'text': return b.text.replace(/[*#[\]()]/g, '');
      case 'button': return b.label;
      case 'columns': return b.heading;
      case 'image': return b.alt;
      case 'footer': return b.tagline;
      case 'stats': return b.items.map((i) => i.value).join(' · ');
      default: return '';
    }
  })();
  return s.split('\n')[0].slice(0, 40);
}

export function EmailDesigner({ blocks, design, onBlocks, onDesign, notify, subject, preheader, postalAddress, firstName = 'Maya', reason, actions }: {
  blocks: NewsletterBlock[];
  design: NewsletterDesign;
  onBlocks: (blocks: NewsletterBlock[]) => void;
  onDesign: (design: NewsletterDesign) => void;
  notify: Notify;
  subject: string;
  preheader: string;
  postalAddress: string;
  firstName?: string;
  /** The "why you're getting this" line under the email. */
  reason?: string;
  /** Extra buttons for the canvas toolbar (e.g. Save as template). */
  actions?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [frameH, setFrameH] = useState(900);
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);
  const [history, setHistory] = useState({ past: 0, future: 0 });
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<{ id: string; path: string } | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lastEdit = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  /** Blocks produced by typing in the canvas: already on screen, don't rewrite. */
  const typed = useRef<NewsletterBlock[] | null>(null);
  const scrollTo = useRef<string | null>(null);

  const html = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return renderNewsletter(
      { subject, preheader, body: '', blocks, design },
      { site: window.location.origin, unsubscribeUrl: '#', postalAddress, firstName, reason, editing: true },
    ).html;
  }, [blocks, design, subject, preheader, postalAddress, firstName, reason]);

  // ------------------------------------------------------------ history

  const commit = useCallback((next: Partial<Snapshot>, key = '') => {
    const now = Date.now();
    // Typing in one place within a moment is one undo step, not one per key.
    const merge = key && key === lastEdit.current.key && now - lastEdit.current.at < 900;
    if (!merge) {
      past.current = [...past.current.slice(-79), { blocks, design }];
      future.current = [];
      setHistory({ past: past.current.length, future: 0 });
    }
    lastEdit.current = { key, at: now };
    if (next.blocks) onBlocks(next.blocks);
    if (next.design) onDesign(next.design);
  }, [blocks, design, onBlocks, onDesign]);

  const travel = useCallback((dir: 'undo' | 'redo') => {
    const from = dir === 'undo' ? past : future;
    const to = dir === 'undo' ? future : past;
    const snap = from.current.at(-1);
    if (!snap) return;
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, { blocks, design }];
    lastEdit.current = { key: '', at: 0 };
    setHistory({ past: past.current.length, future: future.current.length });
    onBlocks(snap.blocks);
    onDesign(snap.design);
  }, [blocks, design, onBlocks, onDesign]);

  // ------------------------------------------------------------ edits

  const index = blocks.findIndex((b) => b.id === selected);
  const current = index >= 0 ? blocks[index] : null;

  const replace = useCallback((next: NewsletterBlock, key = '') => {
    commit({ blocks: blocks.map((b) => (b.id === next.id ? next : b)) }, key);
  }, [blocks, commit]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [b] = next.splice(from, 1);
    next.splice(to, 0, b);
    commit({ blocks: next });
  };

  const duplicate = (i: number) => {
    const copy = { ...structuredClone(blocks[i]), id: newBlock(blocks[i].type).id };
    commit({ blocks: [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)] });
    scrollTo.current = copy.id;
    setSelected(copy.id);
  };

  const remove = (i: number) => {
    commit({ blocks: blocks.filter((_, j) => j !== i) });
    setSelected(null);
  };

  const add = (type: BlockType) => {
    const b = newSection(type, design);
    const at = index >= 0 ? index + 1 : blocks.length;
    commit({ blocks: [...blocks.slice(0, at), b, ...blocks.slice(at)] });
    scrollTo.current = b.id;
    setSelected(b.id);
  };

  const theme = (t: Theme) => commit(applyTheme(t, design, blocks));

  const setImage = useCallback((id: string, path: string, patch: { src: string; alt: string }) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    const keys = path ? path.split('.') : [];
    const prev = (keys.length ? getIn(b, keys) : b) as { alt?: string };
    const merged = { ...prev, src: patch.src, alt: prev?.alt || patch.alt };
    replace((keys.length ? setIn(b, keys, merged) : { ...b, ...merged }) as NewsletterBlock);
  }, [blocks, replace]);

  const upload = useCallback(async (id: string, path: string, file: File) => {
    try {
      const r = await uploadEmailImage(file);
      setImage(id, path, { src: r.url, alt: r.alt });
      if (r.bytes > 1024 * 1024) notify(`That image is ${(r.bytes / 1024 / 1024).toFixed(1)} MB — heavy for email. A JPG around 1200px wide is plenty.`, 'error');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
  }, [notify, setImage]);

  // The canvas's listeners are attached once per write; they read the
  // latest state and callbacks through this ref.
  const live = useRef<Live>({ blocks, selected, type: noop, select: noop, upload: noop, travel: noop, remove: noop });
  useLayoutEffect(() => {
    live.current = {
      blocks, selected,
      type: (id, path, value) => {
        const b = blocks.find((x) => x.id === id);
        if (!b) return;
        const next = blocks.map((x) => (x.id === id ? (setIn(x, path.split('.'), value) as NewsletterBlock) : x));
        typed.current = next;
        commit({ blocks: next }, `${id}:${path}`);
      },
      select: (id) => setSelected(id),
      upload: (id, path, f) => { void upload(id, path, f); },
      travel,
      remove: () => { if (index >= 0) remove(index); },
    };
  });

  // ------------------------------------------------------------ canvas

  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.documentElement) return;
    setFrameH(doc.documentElement.scrollHeight);
    const id = live.current.selected;
    const el = id ? doc.querySelector(`[data-block="${id}"]`) : null;
    if (!el || !frame.current) { setBar(null); return; }
    const r = el.getBoundingClientRect();
    setBar({ top: frame.current.offsetTop + r.top, left: frame.current.offsetLeft + r.right });
  };

  const mark = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-selected]').forEach((el) => el.removeAttribute('data-selected'));
    const id = live.current.selected;
    const el = id ? doc.querySelector(`[data-block="${id}"]`) : null;
    el?.setAttribute('data-selected', '');
    if (el && scrollTo.current === id) {
      scrollTo.current = null;
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
    measure();
  };

  const wire = (doc: Document) => {
    const blockOf = (el: Element | null) => el?.closest<HTMLElement>('[data-block]')?.dataset.block ?? null;
    const isField = (t: EventTarget | null) => t instanceof doc.defaultView!.HTMLElement && t.isContentEditable;

    doc.querySelectorAll<HTMLElement>('[data-field]').forEach((el) => {
      el.contentEditable = 'plaintext-only';
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.spellcheck = true;
    });

    doc.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('a')) e.preventDefault();
      const id = blockOf(t);
      live.current.select(id);
      const img = t.closest<HTMLElement>('[data-img]');
      // An empty image spot opens the file picker straight away.
      if (img && id && img.tagName !== 'IMG') {
        pickTarget.current = { id, path: img.dataset.img ?? '' };
        picker.current?.click();
      }
    });
    doc.addEventListener('dblclick', (e) => {
      const img = (e.target as Element).closest<HTMLElement>('[data-img]');
      const id = blockOf(img);
      if (img && id) { pickTarget.current = { id, path: img.dataset.img ?? '' }; picker.current?.click(); }
    });

    doc.addEventListener('input', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-field]');
      const id = blockOf(el);
      if (!el || !id) return;
      live.current.type(id, el.dataset.field!, fieldText(el).replace(/\n$/, ''));
      measure();
    });

    doc.addEventListener('paste', (e) => {
      const el = e.target as HTMLElement;
      if (!isField(el) || el.contentEditable === 'plaintext-only') return;
      e.preventDefault();
      doc.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    });

    doc.addEventListener('keydown', (e) => {
      const el = (e.target as Element).closest?.<HTMLElement>('[data-field]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        live.current.travel(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (e.key === 'Escape') { el?.blur(); live.current.select(null); return; }
      if (el && e.key === 'Enter' && !MULTILINE.test(el.dataset.field ?? '')) { e.preventDefault(); el.blur(); return; }
      if (!el && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); live.current.remove(); }
    });

    let over: Element | null = null;
    const clear = () => { over?.classList.remove('drop'); over = null; };
    doc.addEventListener('dragover', (e) => {
      const img = (e.target as Element).closest?.('[data-img]') ?? null;
      if (!img || !e.dataTransfer?.types.includes('Files')) { clear(); return; }
      e.preventDefault();
      if (img !== over) { clear(); over = img; img.classList.add('drop'); }
    });
    doc.addEventListener('dragleave', (e) => { if (!(e.relatedTarget as Node | null)) clear(); });
    doc.addEventListener('drop', (e) => {
      const img = (e.target as Element).closest?.<HTMLElement>('[data-img]');
      const file = e.dataTransfer?.files?.[0];
      clear();
      if (!img || !file) return;
      e.preventDefault();
      const id = blockOf(img);
      if (id) { live.current.select(id); live.current.upload(id, img.dataset.img ?? '', file); }
    });

    doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    void doc.fonts?.ready.then(measure);
  };

  const written = useRef('');
  const writeCanvas = useEffectEvent(() => {
    const doc = frame.current?.contentDocument;
    if (!doc || !html || html === written.current) return;
    written.current = html;
    if (typed.current === blocks) return; // typed in the canvas: already on screen
    typed.current = null;
    doc.open();
    doc.write(html);
    doc.close();
    wire(doc);
    requestAnimationFrame(mark);
  });
  useEffect(() => { writeCanvas(); }, [html]);

  const afterSelect = useEffectEvent(() => requestAnimationFrame(mark));
  useEffect(() => { afterSelect(); }, [selected]);
  const relayout = useEffectEvent(() => {
    requestAnimationFrame(measure);
    // Again once the width change has finished animating.
    setTimeout(measure, 260);
  });
  useEffect(() => {
    relayout();
    window.addEventListener('resize', relayout);
    return () => window.removeEventListener('resize', relayout);
  }, [device]);

  // Undo/redo and delete while the focus is in the panels, not a text box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        live.current.travel(e.shiftKey ? 'redo' : 'undo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const width = device === 'desktop' ? 680 : 390;

  return (
    <div className={d.designer}>
      <aside className={d.rail} aria-label="Sections">
        {SECTION_GROUPS.map((g) => (
          <div key={g.label} className={d.railGroup}>
            <p className={d.railTitle}>{g.label}</p>
            <div className={d.tiles}>
              {g.types.map((t) => (
                <button key={t} type="button" className={d.tile} onClick={() => add(t)} title={BLOCK_HINT[t]}>
                  <Thumb type={t} />
                  <span>{BLOCK_LABEL[t]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className={d.hint} style={{ margin: '0 2px 14px' }}>Adds below the selected section.</p>

        <div className={d.railGroup}>
          <p className={d.railTitle}>Layers</p>
          <ol className={d.layers}>
            {blocks.map((b, i) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); }}
                onDragEnd={() => setDragFrom(null)}
                className={`${d.layer} ${b.id === selected ? d.layerOn : ''} ${dragFrom === i ? d.layerDragging : ''}`}
              >
                <button type="button" onClick={() => { scrollTo.current = b.id; setSelected(b.id); }}>
                  <span className={d.layerDot} style={{ background: b.bg || design.contentBg }} />
                  <span className={d.layerName}>{BLOCK_LABEL[b.type]}</span>
                  <span className={d.layerSnippet}>{snippet(b)}</span>
                </button>
              </li>
            ))}
          </ol>
          {blocks.length > 1 && <p className={d.hint}>Drag to reorder.</p>}
        </div>
      </aside>

      <div className={d.stage} ref={stage}>
        <div className={d.stageBar}>
          <span className={d.iconRow}>
            <button type="button" onClick={() => travel('undo')} disabled={!history.past} title="Undo (⌘Z)" aria-label="Undo">↶</button>
            <button type="button" onClick={() => travel('redo')} disabled={!history.future} title="Redo (⇧⌘Z)" aria-label="Redo">↷</button>
          </span>
          <div className={d.segmented} role="radiogroup" aria-label="Preview size">
            <button type="button" role="radio" aria-checked={device === 'desktop'} className={device === 'desktop' ? d.segOn : ''} onClick={() => setDevice('desktop')}>Desktop</button>
            <button type="button" role="radio" aria-checked={device === 'mobile'} className={device === 'mobile' ? d.segOn : ''} onClick={() => setDevice('mobile')}>Phone</button>
          </div>
          <span style={{ flex: 1 }} />
          {actions}
        </div>
        <div className={d.canvasWrap} style={{ width }} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <iframe ref={frame} title="Email canvas" className={d.frame} style={{ width, height: frameH }} />
          {bar && current && (
            <div className={d.floatBar} style={{ top: Math.max(bar.top - 34, 4), left: bar.left }}>
              <span className={d.floatLabel}>{BLOCK_LABEL[current.type]}</span>
              <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move up" title="Move up">↑</button>
              <button type="button" onClick={() => move(index, index + 1)} disabled={index === blocks.length - 1} aria-label="Move down" title="Move down">↓</button>
              <button type="button" onClick={() => duplicate(index)} aria-label="Duplicate" title="Duplicate">⧉</button>
              <button type="button" onClick={() => remove(index)} aria-label="Delete section" title="Delete">✕</button>
            </div>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            const target = pickTarget.current;
            if (f && target) void upload(target.id, target.path, f);
            e.target.value = '';
          }}
        />
      </div>

      <aside className={d.panel} aria-label={current ? 'Section settings' : 'Email style'}>
        {current ? (
          <SectionInspector
            key={current.id}
            block={current}
            onChange={(next) => replace(next, `panel:${current.id}`)}
            notify={notify}
            onMove={(by) => move(index, index + by)}
            onDuplicate={() => duplicate(index)}
            onDelete={() => remove(index)}
            canUp={index > 0}
            canDown={index < blocks.length - 1}
          />
        ) : (
          <StylePanel design={design} onDesign={(next) => commit({ design: next }, 'style')} onTheme={theme} notify={notify} />
        )}
        {current && (
          <button type="button" className={d.backToStyle} onClick={() => setSelected(null)}>← Email style</button>
        )}
      </aside>
    </div>
  );
}

/** A tiny drawing of each section for the picker. */
function Thumb({ type }: { type: BlockType }) {
  const bar = (w: string, c = '#c9c6c1', h = 4) => <i style={{ width: w, height: h, background: c }} />;
  const box = (bg: string, children: React.ReactNode, extra: React.CSSProperties = {}) => (
    <span className={d.thumb} style={{ background: bg, ...extra }}>{children}</span>
  );
  switch (type) {
    case 'header': return box('#0a0a0a', <><span className={d.thumbRow}>{bar('34%', '#fff', 6)}<span style={{ flex: 1 }} />{bar('14%', '#777', 3)}{bar('14%', '#777', 3)}</span></>, { justifyContent: 'center' });
    case 'hero': return box('#0a0a0a', <>{bar('30%', '#e50586', 3)}{bar('85%', '#fff', 7)}{bar('60%', '#fff', 7)}{bar('34%', '#e50586', 6)}</>);
    case 'gallery': return box('#fff', <span className={d.thumbRow}><i className={d.thumbImg} /><i className={d.thumbImg} /></span>);
    case 'stats': return box('#f5f4f1', <span className={d.thumbRow} style={{ justifyContent: 'space-around' }}>{bar('18%', '#e50586', 8)}{bar('18%', '#e50586', 8)}{bar('18%', '#e50586', 8)}</span>, { justifyContent: 'center' });
    case 'features': return box('#fff', <>{[0, 1, 2].map((i) => <span key={i} className={d.thumbRow}>{bar('10%', '#e50586', 4)}{bar('60%')}</span>)}</>);
    case 'quote': return box('#fff7fb', <>{bar('14%', '#e50586', 7)}{bar('85%', '#555', 4)}{bar('60%', '#555', 4)}</>);
    case 'cta': return box('#e50586', <>{bar('70%', '#fff', 7)}{bar('34%', '#fff', 7)}</>, { alignItems: 'center', justifyContent: 'center' });
    case 'footer': return box('#0a0a0a', <>{bar('10%', '#fff', 8)}{bar('50%', '#777', 3)}</>, { alignItems: 'center', justifyContent: 'center' });
    case 'image': return box('#fff', <i className={d.thumbImg} style={{ height: '100%' }} />, { padding: 0 });
    case 'heading': return box('#fff', <>{bar('80%', '#222', 8)}</>, { justifyContent: 'center' });
    case 'text': return box('#fff', <>{bar('90%')}{bar('85%')}{bar('70%')}</>, { justifyContent: 'center' });
    case 'button': return box('#fff', <>{bar('44%', '#e50586', 9)}</>, { justifyContent: 'center' });
    case 'columns': return box('#fff', <span className={d.thumbRow}><i className={d.thumbImg} /><span style={{ flex: 1, display: 'grid', gap: 3 }}>{bar('90%', '#222')}{bar('80%')}{bar('60%')}</span></span>);
    case 'divider': return box('#fff', <>{bar('90%', '#ddd', 1)}</>, { justifyContent: 'center' });
    case 'spacer': return box('#fff', <span style={{ border: '1px dashed #ccc', height: '60%', width: '90%' }} />, { justifyContent: 'center', alignItems: 'center' });
    case 'social': return box('#fff', <span className={d.thumbRow} style={{ justifyContent: 'center' }}>{bar('20%', '#e50586', 3)}{bar('20%', '#e50586', 3)}</span>, { justifyContent: 'center' });
  }
}
