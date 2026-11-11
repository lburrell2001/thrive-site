'use client';

// Website → Homepage: the homepage's photos.
// - Hero mosaic: desktop and phones each have their own layout. Drag tiles to
//   any spot, resize from the corner, click an empty cell to add a tile there,
//   and choose each tile's photo (MosaicEditor.tsx; rules in
//   src/lib/collageLayout.ts, shared with the homepage).
// - The three photos above the statement and the two inside the services
//   heading. Left on Automatic, they show projects that aren't in the mosaic.
// - The photo strips on About, Contact and Book a call (Automatic = a mix by service).
// - The three quotes under "Beyond clients. Trusted partners.": a client's
//   approved review or one typed here (defaults: the three it launched with).
// - The link preview: the picture shown when the homepage link is texted or
//   posted (cropped to 1200×630 by /share-image). Default: Classic Rollers Car Club.
// Only case-study images are offered, so every photo is real client work.

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { COLS, MAX_TILES, PRESETS, autoPhotos, canPlace, emptyCells, firstFree, phoneFrom, type Layout, type Rect } from '@/lib/collageLayout';
import { mixedPhotos } from '@/lib/workPhotos';
import MosaicEditor from './MosaicEditor';
import { useCrm } from '../crm/CrmContext';
import s from './homepage.module.css';

type Pick = { slug: string; src: string };
type Placed = Pick & Rect;
type StripPage = 'about' | 'contact' | 'book';
type QuoteSlot = { kind: 'review'; id: string } | { kind: 'custom'; text: string; who: string; contact_id?: string | null; service?: string | null; review_id?: string | null };
const SERVICES: [string, string][] = [['brand-design', 'Brand Design'], ['digital-design', 'Web Design & Development'], ['social-media', 'Social Media'], ['photography', 'Photography']];
type Config = { mosaic: Record<Layout, Placed[]>; fan: (Pick | null)[]; inline: (Pick | null)[]; pages: Record<StripPage, (Pick | null)[]>; share: Pick | null; quotes?: QuoteSlot[] };
type Review = { id: string; text: string; who: string; rating: number | null };
const QUOTE_COLOURS = [{ bg: '#3943b7', fg: '#fff' }, { bg: '#0cf574', fg: '#141414' }, { bg: '#e50586', fg: '#fff' }];
const DEFAULT_SHARE: Pick = { slug: 'classic-rollers-car-club', src: '/case-studies/classic-rollers-car-club/mockup-screens.webp' };
const STRIPS: { page: StripPage; label: string; hint: string; href: string }[] = [
  { page: 'about', label: 'About', hint: 'the row of five photos', href: '/about' },
  { page: 'contact', label: 'Contact', hint: 'the three beside “Ready to Thrive?”', href: '/contact' },
  { page: 'book', label: 'Book a call', hint: 'the four above the calendar', href: '/book' },
];
type Shown = { fan: string[]; inline: string[] };
type Library = { slug: string; title: string; images: { src: string; url: string; alt: string }[] }[];
type Data = { library: Library; config: Config; shown: Shown; reviews?: Review[] };
type Target = { kind: 'tile'; i: number } | { kind: 'new'; rect: Rect } | { kind: 'fan'; i: number } | { kind: 'inline'; i: number } | { kind: 'strip'; page: StripPage; i: number } | { kind: 'share' };

const rectOf = ({ col, row, w: width, h }: Rect): Rect => ({ col, row, w: width, h });

export default function HomepageAdmin() {
  const { contacts } = useCrm();
  const [data, setData] = useState<Data | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [target, setTarget] = useState<Target>({ kind: 'tile', i: 0 });
  const [layout, setLayout] = useState<Layout>('desktop');
  const [project, setProject] = useState('all');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [hint, setHint] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    apiGet<Data>('/api/admin/homepage')
      .then((d) => { setData(d); setConfig(d.config); })
      .catch((e) => setFailed(e instanceof Error ? e.message : 'Could not load'));
  }, []);

  if (!data || !config) return <div className={w.page}><p className={w.muted}>{failed || 'Loading…'}</p></div>;

  const all = data.library.flatMap((pr) => pr.images.map((im) => ({ ...im, slug: pr.slug, title: pr.title })));
  const find = (pk: Pick | null) => (pk ? all.find((im) => im.src === pk.src && im.slug === pk.slug) ?? null : null);
  const dirty = JSON.stringify(config) !== JSON.stringify(data.config);
  const tiles = config.mosaic[layout];
  const cols = COLS[layout];
  const used = new Set([...tiles, ...config.fan, ...config.inline].filter(Boolean).map((pk) => pk!.src));

  const update = (fn: (c: Config) => Config) => { setConfig((c) => (c ? fn(c) : c)); setNote(null); };
  const setTiles = (fn: (t: Placed[]) => Placed[]) => update((c) => ({ ...c, mosaic: { ...c.mosaic, [layout]: fn(c.mosaic[layout]) } }));
  const setStrip = (page: StripPage, i: number, pk: Pick | null) =>
    update((c) => ({ ...c, pages: { ...c.pages, [page]: c.pages[page].map((x, k) => (k === i ? pk : x)) } }));

  const selectedIndex = target.kind === 'tile' && target.i < tiles.length ? target.i : null;
  const selected = selectedIndex !== null ? tiles[selectedIndex] : null;
  const pending = target.kind === 'new' ? target.rect : null;
  const gaps = emptyCells(tiles.map(rectOf), cols);
  // Automatic statement/heading photos: projects not in the desktop mosaic (same rule as the homepage).
  const auto = autoPhotos(config.mosaic.desktop.map((t) => `/work/${t.slug}`), config.fan.length + config.inline.length);
  const autoFor = (key: 'fan' | 'inline', i: number) => auto[key === 'fan' ? i : config.fan.length + i];

  function switchLayout(next: Layout) {
    setLayout(next);
    setTarget({ kind: 'tile', i: 0 });
    setHint('');
  }

  function choose(slug: string, src: string) {
    const pk = { slug, src };
    if (target.kind === 'new') {
      setTiles((t) => [...t, { ...pk, ...target.rect }]);
      setTarget({ kind: 'tile', i: tiles.length });
    } else if (target.kind === 'tile') {
      setTiles((t) => t.map((x, i) => (i === target.i ? { ...x, ...pk } : x)));
    } else if (target.kind === 'strip') {
      setStrip(target.page, target.i, pk);
    } else if (target.kind === 'share') {
      update((c) => ({ ...c, share: pk }));
    } else {
      const key = target.kind;
      update((c) => ({ ...c, [key]: c[key].map((x, i) => (i === target.i ? pk : x)) }));
    }
  }

  function addTile(rect?: Rect) {
    if (tiles.length >= MAX_TILES) return;
    const spot = rect ?? firstFree(tiles.map(rectOf), 1, 1, cols);
    if (spot) { setTarget({ kind: 'new', rect: spot }); setHint(''); }
  }

  function resizeSelected(wd: number, ht: number) {
    if (selectedIndex === null || !selected) return;
    const rects = tiles.map(rectOf);
    const here = { col: Math.min(selected.col, cols - wd + 1), row: selected.row, w: wd, h: ht };
    const spot = canPlace(rects, here, cols, selectedIndex) ? here : null;
    if (!spot) { setHint('That size doesn’t fit where the tile is. Drag it somewhere with more room, or move the tiles next to it.'); return; }
    setHint('');
    setTiles((t) => t.map((x, i) => (i === selectedIndex ? { ...x, ...spot } : x)));
  }

  function remove(i: number) {
    if (tiles.length <= 1) return;
    setTiles((t) => t.filter((_, k) => k !== i));
    setTarget({ kind: 'tile', i: Math.max(0, i - 1) });
  }

  function copyDesktop() {
    const rects = phoneFrom(config!.mosaic.desktop.map(rectOf));
    update((c) => ({ ...c, mosaic: { ...c.mosaic, phone: c.mosaic.desktop.map((t, i) => ({ slug: t.slug, src: t.src, ...rects[i] })) } }));
    setTarget({ kind: 'tile', i: 0 });
  }

  async function save() {
    setSaving(true); setNote(null);
    try {
      const r = await apiSend<{ config: Config; shown: Shown }>('/api/admin/homepage', 'PATCH', config);
      setData((d) => (d ? { ...d, config: r.config, shown: r.shown } : d));
      setConfig(r.config);
      if (target.kind === 'new') setTarget({ kind: 'tile', i: 0 });
      setNote({ text: 'Saved. The homepage shows these now.', tone: 'ok' });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'Could not save', tone: 'error' });
    }
    setSaving(false);
  }

  const library = project === 'all' ? data.library : data.library.filter((pr) => pr.slug === project);
  const targetText =
    target.kind === 'new' ? 'Pick a photo below for the new tile.'
    : target.kind === 'tile' ? `${layout === 'phone' ? 'Phone' : 'Desktop'} tile ${target.i + 1} is selected. Pick a photo below to change it.`
    : target.kind === 'fan' ? `Statement photo ${target.i + 1} is selected. Pick a photo below.`
    : target.kind === 'inline' ? `Heading photo ${target.i + 1} is selected. Pick a photo below.`
    : target.kind === 'share' ? 'The link preview is selected. Pick a photo below.'
    : `${STRIPS.find((x) => x.page === target.page)?.label} photo ${target.i + 1} is selected. Pick a photo below.`;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Homepage</h1>
          <p className={w.sub}>The photos on the homepage, and the photo strips on About, Contact and Book a call. Click a spot, then a photo below to put it there. Every photo links to its case study.</p>
        </div>
        <div className={w.headActions}>
          <a className={p.btn} href="/" target="_blank" rel="noreferrer">View page ↗</a>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {note && <p style={{ color: note.tone === 'error' ? 'var(--a-danger)' : '#141414', margin: '0 0 12px' }}>{note.text}</p>}

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <div className={s.bar}>
          <h2 className={s.sectionTitle}>Hero mosaic <span className={w.muted}>· {layout === 'phone' ? 'phones' : 'desktop'} · {tiles.length} tile{tiles.length === 1 ? '' : 's'}</span></h2>
          <div className={s.barGroup}>
            <div className={w.chips} role="group" aria-label="Layout">
              <button type="button" className={`${w.chip} ${layout === 'desktop' ? w.chipOn : ''}`} onClick={() => switchLayout('desktop')}>Desktop · {config.mosaic.desktop.length}</button>
              <button type="button" className={`${w.chip} ${layout === 'phone' ? w.chipOn : ''}`} onClick={() => switchLayout('phone')}>Phone · {config.mosaic.phone.length}</button>
            </div>
            {layout === 'phone' && <button type="button" className={p.btn} onClick={copyDesktop} title="Replace the phone layout with the desktop tiles, sized for phones">Copy from desktop</button>}
            <button type="button" className={p.btn} disabled={tiles.length >= MAX_TILES || pending !== null} onClick={() => addTile()}>+ Add tile</button>
          </div>
        </div>

        {(selected || pending) && (
          <div className={s.tools}>
            <span className={s.toolsLabel}>{pending ? 'New tile' : `Tile ${selectedIndex! + 1} · ${selected!.w}×${selected!.h}`}</span>
            {selected && (
              <div className={w.chips} role="group" aria-label="Size">
                {PRESETS[layout].map((ps) => (
                  <button key={ps.label} type="button" className={`${w.chip} ${selected.w === ps.w && selected.h === ps.h ? w.chipOn : ''}`} onClick={() => resizeSelected(ps.w, ps.h)}>
                    {ps.label} <span className={s.dim}>{ps.w}×{ps.h}</span>
                  </button>
                ))}
              </div>
            )}
            {selected && <button type="button" className={p.btn} disabled={tiles.length <= 1} onClick={() => remove(selectedIndex!)}>Remove tile</button>}
            {pending && <button type="button" className={p.btn} onClick={() => setTarget({ kind: 'tile', i: 0 })}>Cancel</button>}
          </div>
        )}
        {hint && <p className={s.warn} style={{ margin: '0 0 10px', fontSize: 13 }}>{hint}</p>}

        <MosaicEditor
          key={layout}
          layout={layout}
          tiles={tiles.map((t, i) => {
            const im = find(t);
            return { ...rectOf(t), key: `${i}-${t.src}`, url: im?.url, label: `${i + 1}${im ? ` · ${im.title}` : ''}` };
          })}
          selected={selectedIndex}
          pending={pending}
          onSelect={(i) => { setTarget({ kind: 'tile', i }); setHint(''); }}
          onChange={(rects) => setTiles((t) => t.map((x, i) => ({ ...x, ...rects[i] })))}
          onEmptyCell={(col, row) => addTile({ col, row, w: 1, h: 1 })}
        />
        <p className={w.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>
          Drag a tile to move it, drag its corner to resize, or drop it on a tile the same size to swap. Click a + to add a tile there.
          {gaps > 0 && <span className={s.warn}> {gaps} empty cell{gaps === 1 ? '' : 's'} will show as blank space.</span>}
        </p>
      </section>

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <div className={s.pairs}>
          {(['fan', 'inline'] as const).map((key) => (
            <div key={key}>
              <h2 className={s.sectionTitle}>{key === 'fan' ? 'Statement photos' : 'Heading photos'}</h2>
              <p className={w.muted} style={{ margin: '2px 0 10px', fontSize: 13 }}>
                {key === 'fan' ? 'The three cards above “We’re a Dallas creative studio where color meets strategy.”' : 'The two photos inside “We’re a … Full-Service … Creative Studio.”'}
              </p>
              <div className={s.slots}>
                {config[key].map((pk, i) => {
                  const im = find(pk);
                  const on = target.kind === key && target.i === i;
                  return (
                    <button key={i} type="button" className={`${s.slot} ${on ? s.tileOn : ''}`} onClick={() => setTarget({ kind: key, i })} aria-pressed={on}>
                      <img src={im?.url ?? autoFor(key, i)} alt="" />
                      <span className={s.tileLabel}>{i + 1} · {im ? im.title : 'Automatic'}</span>
                      {pk && (
                        <span role="button" tabIndex={0} className={s.reset} title="Back to automatic"
                          onClick={(e) => { e.stopPropagation(); update((c) => ({ ...c, [key]: c[key].map((x, k) => (k === i ? null : x)) })); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); update((c) => ({ ...c, [key]: c[key].map((x, k) => (k === i ? null : x)) })); } }}>↺</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className={w.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Automatic photos are projects that aren’t in the mosaic, so they change when the mosaic does.</p>
      </section>

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <h2 className={s.sectionTitle}>Quotes</h2>
        <p className={w.muted} style={{ margin: '2px 0 12px', fontSize: 13 }}>
          The three cards under “Beyond clients. Trusted partners.” Pick a client’s review (approved on the Reviews page, with their okay to publish) or type one.
          {!(data.reviews ?? []).length && ' No approved reviews yet, so you can type them for now.'}
        </p>
        <div className={s.quotes}>
          {(config.quotes ?? []).map((q, i) => {
            const review = q.kind === 'review' ? (data.reviews ?? []).find((r) => r.id === q.id) : null;
            const setQuote = (next: QuoteSlot) => update((c) => ({ ...c, quotes: (c.quotes ?? []).map((x, k) => (k === i ? next : x)) }));
            const colour = QUOTE_COLOURS[i % QUOTE_COLOURS.length];
            return (
              <div key={i} className={s.quoteSlot}>
                <span className={s.quoteSwatch} style={{ background: colour.bg }} aria-hidden />
                <select className={p.select} value={q.kind === 'review' ? q.id : 'custom'} aria-label={`Quote ${i + 1}`}
                  onChange={(e) => setQuote(e.target.value === 'custom'
                    ? { kind: 'custom', text: review?.text ?? '', who: review?.who ?? '' }
                    : { kind: 'review', id: e.target.value })}>
                  <option value="custom">Type my own</option>
                  {(data.reviews ?? []).map((r) => <option key={r.id} value={r.id}>{r.who}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}: “{r.text.slice(0, 50)}{r.text.length > 50 ? '…' : ''}”</option>)}
                </select>
                {q.kind === 'custom' ? (<>
                  <textarea className={p.textarea} rows={5} maxLength={2000} value={q.text} placeholder="What they said" onChange={(e) => setQuote({ ...q, text: e.target.value })} />
                  <input className={p.input} value={q.who} placeholder="Who said it, e.g. DJ Mastamind" onChange={(e) => setQuote({ ...q, who: e.target.value })} />
                  <select className={p.select} value={q.contact_id ?? ''} aria-label={`Client for quote ${i + 1}`}
                    onChange={(e) => {
                      const c = (contacts ?? []).find((x) => x.id === e.target.value);
                      // Picking a client fills in who said it: their name and company.
                      const name = c ? [c.name, c.company].filter(Boolean).join(', ') : '';
                      setQuote({ ...q, contact_id: e.target.value || null, who: name || q.who });
                    }}>
                    <option value="">Attach to a client (optional)</option>
                    {(contacts ?? []).filter((c) => c.name || c.company).map((c) => <option key={c.id} value={c.id}>{[c.name, c.company].filter(Boolean).join(' · ')}</option>)}
                  </select>
                  <select className={p.select} value={q.service ?? ''} aria-label={`Service for quote ${i + 1}`} onChange={(e) => setQuote({ ...q, service: e.target.value || null })}>
                    <option value="">Tag a service (optional)</option>
                    {SERVICES.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
                  </select>
                  {(q.contact_id || q.service) && (
                    <span className={w.muted} style={{ fontSize: 12 }}>
                      Saved as a review{q.contact_id ? ' on their contact' : ''}{q.service ? `, and shown on the ${SERVICES.find(([sl]) => sl === q.service)?.[1]} page` : ''}.
                    </span>
                  )}
                </>) : (
                  <blockquote className={s.quotePreview} style={{ background: colour.bg, color: colour.fg }}>
                    {review ? <>“{review.text}”<cite>{review.who}</cite></> : 'That review isn’t approved any more, so the original quote shows here.'}
                  </blockquote>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <h2 className={s.sectionTitle}>Link preview</h2>
        <p className={w.muted} style={{ margin: '2px 0 12px', fontSize: 13 }}>The picture that shows when you text or post a link to the homepage. It’s cropped to the preview’s wide shape, as below.</p>
        {(() => {
          const im = find(config.share) ?? find(DEFAULT_SHARE);
          const on = target.kind === 'share';
          return (
            <div className={s.share}>
              <button type="button" className={`${s.shareCard} ${on ? s.tileOn : ''}`} onClick={() => setTarget({ kind: 'share' })} aria-pressed={on}>
                <span className={s.shareImg}>{im && <img src={im.url} alt="" />}</span>
                <span className={s.shareText}>
                  <strong>Thrive Creative Studios</strong>
                  <span>thrivecreativestudios.org</span>
                </span>
              </button>
              <div className={s.shareSide}>
                <p style={{ margin: 0, fontSize: 13 }}><strong>{im?.title ?? 'Classic Rollers Car Club'}</strong>{config.share ? '' : ' · the default'}</p>
                <p className={w.muted} style={{ margin: '4px 0 0', fontSize: 12.5 }}>Click the preview, then a photo below. Apps keep the picture of a link already sent, so the new one shows on links sent after you save.</p>
                {config.share && <button type="button" className={p.btn} style={{ marginTop: 10 }} onClick={() => update((c) => ({ ...c, share: null }))}>Back to the default</button>}
              </div>
            </div>
          );
        })()}
      </section>

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <h2 className={s.sectionTitle}>Photos on other pages</h2>
        <p className={w.muted} style={{ margin: '2px 0 12px', fontSize: 13 }}>The photo strips on About, Contact and Book a call. Automatic is a mix of projects, one per service.</p>
        {STRIPS.map(({ page, label, hint, href }) => {
          const auto = mixedPhotos(config.pages[page].length);
          return (
            <div key={page} style={{ marginBottom: 14 }}>
              <p className={s.stripTitle}>{label} <span className={w.muted} style={{ fontWeight: 500 }}>· {hint}</span> <a href={href} target="_blank" rel="noreferrer" className={w.muted}>View ↗</a></p>
              <div className={s.slots}>
                {config.pages[page].map((pk, i) => {
                  const im = find(pk);
                  const on = target.kind === 'strip' && target.page === page && target.i === i;
                  return (
                    <button key={i} type="button" className={`${s.slot} ${on ? s.tileOn : ''}`} onClick={() => setTarget({ kind: 'strip', page, i })} aria-pressed={on}>
                      <img src={im?.url ?? auto[i % auto.length]?.src} alt="" />
                      <span className={s.tileLabel}>{i + 1} · {im ? im.title : `Automatic · ${auto[i % auto.length]?.caption ?? ''}`}</span>
                      {pk && (
                        <span role="button" tabIndex={0} className={s.reset} title="Back to automatic"
                          onClick={(e) => { e.stopPropagation(); setStrip(page, i, null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setStrip(page, i, null); } }}>↺</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <p className={s.targetNote}>{targetText}</p>
      <div className={w.toolbar}>
        <div className={w.chips} role="group" aria-label="Project">
          <button type="button" className={`${w.chip} ${project === 'all' ? w.chipOn : ''}`} onClick={() => setProject('all')}>All projects</button>
          {data.library.map((pr) => (
            <button key={pr.slug} type="button" className={`${w.chip} ${project === pr.slug ? w.chipOn : ''}`} onClick={() => setProject(pr.slug)}>{pr.title}</button>
          ))}
        </div>
      </div>

      {library.map((pr) => (
        <section key={pr.slug} style={{ marginBottom: 22 }}>
          <h2 className={s.projectTitle}>{pr.title}</h2>
          <div className={s.library}>
            {pr.images.map((im) => (
              <button key={im.src} type="button" className={`${s.thumb} ${used.has(im.src) ? s.thumbUsed : ''}`} onClick={() => choose(pr.slug, im.src)} title={im.alt}>
                <img src={im.url} alt={im.alt} loading="lazy" />
                {used.has(im.src) && <span className={s.usedTag}>In use</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
