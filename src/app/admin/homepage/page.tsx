'use client';

// Website → Homepage: the homepage's photos.
// - Hero mosaic: add, remove, resize and reorder tiles (drag, or the arrows),
//   and choose each tile's photo. The preview is packed by the same code as the
//   homepage (src/lib/collageLayout.ts), so what you see is what the site shows.
// - The three photos above the statement and the two inside the services
//   heading. Left on Automatic, they show projects that aren't in the mosaic.
// Only case-study images are offered, so every photo is real client work.

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { DESKTOP_COLS, MAX_TILES, autoPhotos, PHONE_COLS, SIZE_ORDER, TILE_SIZES, packTiles, tileStyleVars, type TileSize } from '@/lib/collageLayout';
import s from './homepage.module.css';

type Pick = { slug: string; src: string };
type TilePick = Pick & { size: TileSize };
type Config = { tiles: TilePick[]; fan: (Pick | null)[]; inline: (Pick | null)[] };
type Shown = { fan: string[]; inline: string[] };
type Library = { slug: string; title: string; images: { src: string; url: string; alt: string }[] }[];
type Data = { library: Library; config: Config; shown: Shown };
type Target = { kind: 'tile'; i: number } | { kind: 'new' } | { kind: 'fan'; i: number } | { kind: 'inline'; i: number };

export default function HomepageAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [target, setTarget] = useState<Target>({ kind: 'tile', i: 0 });
  const [newSize, setNewSize] = useState<TileSize>('small');
  const [phone, setPhone] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [project, setProject] = useState('all');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
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
  const used = new Set([...config.tiles, ...config.fan, ...config.inline].filter(Boolean).map((pk) => pk!.src));

  const update = (fn: (c: Config) => Config) => { setConfig((c) => (c ? fn(c) : c)); setNote(null); };
  const setTiles = (fn: (t: TilePick[]) => TilePick[]) => update((c) => ({ ...c, tiles: fn(c.tiles) }));

  // The preview: the tiles, plus the empty "new tile" spot while adding one.
  const adding = target.kind === 'new';
  const sizes = [...config.tiles.map((t) => t.size), ...(adding ? [newSize] : [])];
  const spots = tileStyleVars(sizes);
  const gaps = packTiles(sizes, phone ? PHONE_COLS : DESKTOP_COLS).gaps;
  const selected = target.kind === 'tile' ? config.tiles[target.i] : null;
  // Automatic statement/heading photos: projects not in the mosaic (same rule as the homepage).
  const auto = autoPhotos(config.tiles.map((t) => `/work/${t.slug}`), config.fan.length + config.inline.length);
  const autoFor = (key: 'fan' | 'inline', i: number) => auto[key === 'fan' ? i : config.fan.length + i];

  function choose(slug: string, src: string) {
    const pk = { slug, src };
    if (target.kind === 'new') {
      setTiles((t) => [...t, { ...pk, size: newSize }]);
      setTarget({ kind: 'tile', i: config!.tiles.length });
    } else if (target.kind === 'tile') {
      setTiles((t) => t.map((x, i) => (i === target.i ? { ...pk, size: x.size } : x)));
    } else {
      const key = target.kind;
      update((c) => ({ ...c, [key]: c[key].map((x, i) => (i === target.i ? pk : x)) }));
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= config!.tiles.length || from === to) return;
    setTiles((t) => { const n = [...t]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
    setTarget({ kind: 'tile', i: to });
  }

  function remove(i: number) {
    if (config!.tiles.length <= 1) return;
    setTiles((t) => t.filter((_, k) => k !== i));
    setTarget({ kind: 'tile', i: Math.max(0, i - 1) });
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
    : target.kind === 'tile' ? `Tile ${target.i + 1} is selected. Pick a photo below to change it.`
    : target.kind === 'fan' ? `Statement photo ${target.i + 1} is selected. Pick a photo below.`
    : `Heading photo ${target.i + 1} is selected. Pick a photo below.`;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Homepage</h1>
          <p className={w.sub}>The photos on the homepage. Click a spot, then a photo below to put it there. Mosaic tiles link to their case study.</p>
        </div>
        <div className={w.headActions}>
          <a className={p.btn} href="/" target="_blank" rel="noreferrer">View page ↗</a>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {note && <p style={{ color: note.tone === 'error' ? 'var(--a-danger)' : '#0a7d4a', margin: '0 0 12px' }}>{note.text}</p>}

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <div className={s.bar}>
          <h2 className={s.sectionTitle}>Hero mosaic <span className={w.muted}>· {config.tiles.length} tile{config.tiles.length === 1 ? '' : 's'}</span></h2>
          <div className={s.barGroup}>
            <div className={w.chips} role="group" aria-label="Preview">
              <button type="button" className={`${w.chip} ${!phone ? w.chipOn : ''}`} onClick={() => setPhone(false)}>Desktop</button>
              <button type="button" className={`${w.chip} ${phone ? w.chipOn : ''}`} onClick={() => setPhone(true)}>Phone</button>
            </div>
            <button type="button" className={p.btn} disabled={config.tiles.length >= MAX_TILES || adding}
              onClick={() => setTarget({ kind: 'new' })}>+ Add tile</button>
          </div>
        </div>

        {/* What the selected tile (or the one being added) is: size, place, remove. */}
        {(selected || adding) && (
          <div className={s.tools}>
            <span className={s.toolsLabel}>{adding ? 'New tile' : `Tile ${(target as { i: number }).i + 1}`}</span>
            <div className={w.chips} role="group" aria-label="Size">
              {SIZE_ORDER.map((size) => {
                const on = adding ? newSize === size : selected?.size === size;
                return (
                  <button key={size} type="button" className={`${w.chip} ${on ? w.chipOn : ''}`}
                    onClick={() => (adding ? setNewSize(size) : setTiles((t) => t.map((x, i) => (target.kind === 'tile' && i === target.i ? { ...x, size } : x))))}>
                    {TILE_SIZES[size].label}
                  </button>
                );
              })}
            </div>
            {target.kind === 'tile' && (
              <>
                <button type="button" className={p.btn} disabled={target.i === 0} onClick={() => move(target.i, target.i - 1)} aria-label="Move earlier">← Earlier</button>
                <button type="button" className={p.btn} disabled={target.i === config.tiles.length - 1} onClick={() => move(target.i, target.i + 1)} aria-label="Move later">Later →</button>
                <button type="button" className={p.btn} disabled={config.tiles.length <= 1} onClick={() => remove(target.i)}>Remove tile</button>
              </>
            )}
            {adding && <button type="button" className={p.btn} onClick={() => setTarget({ kind: 'tile', i: 0 })}>Cancel</button>}
          </div>
        )}

        <div className={`${s.grid} ${phone ? s.gridPhone : ''}`}>
          {config.tiles.map((t, i) => {
            const im = find(t);
            const on = target.kind === 'tile' && target.i === i;
            return (
              <button key={`${i}-${t.src}`} type="button" className={`${s.tile} ${on ? s.tileOn : ''} ${dragFrom === i ? s.tileDragging : ''}`}
                style={spots[i] as React.CSSProperties} draggable
                onDragStart={() => setDragFrom(i)} onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); }}
                onClick={() => setTarget({ kind: 'tile', i })} aria-pressed={on}
                aria-label={`Tile ${i + 1} (${TILE_SIZES[t.size].label})${im ? `: ${im.title}` : ''}`}>
                {im && <img src={im.url} alt="" draggable={false} />}
                <span className={s.tileLabel}>{i + 1} · {TILE_SIZES[t.size].label}{im ? ` · ${im.title}` : ''}</span>
              </button>
            );
          })}
          {adding && (
            <div className={`${s.tile} ${s.tileOn} ${s.tileNew}`} style={spots[config.tiles.length] as React.CSSProperties}>
              <span>Pick a photo below</span>
            </div>
          )}
        </div>
        <p className={w.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>
          {gaps > 0
            ? <span className={s.warn}>{gaps} empty space{gaps === 1 ? '' : 's'} on {phone ? 'phones' : 'desktop'}. Change a size, reorder, or add a Small tile to fill {gaps === 1 ? 'it' : 'them'}.</span>
            : `No gaps on ${phone ? 'phones' : 'desktop'}.`}
          {' '}Drag tiles to reorder. Tiles fill in order, each into the first space it fits.
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
