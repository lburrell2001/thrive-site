'use client';

// Website → Homepage: choose the seven photos in the homepage hero collage.
// Click a tile, then a photo below to put it there. Only case-study images
// are offered, so every tile is real client work that links to its case study.

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import s from './homepage.module.css';

type Pick = { slug: string; src: string } | null;
type Tile = { slug: string; src: string; url: string; alt: string; title: string };
type Library = { slug: string; title: string; images: { src: string; url: string; alt: string }[] }[];
type Data = { library: Library; picks: Pick[]; tiles: Tile[]; shapes: string[] };

const AREAS = 'abcdefg';

export default function HomepageAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [slot, setSlot] = useState(0);
  const [project, setProject] = useState('all');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    apiGet<Data>('/api/admin/homepage')
      .then((d) => { setData(d); setPicks(d.picks); })
      .catch((e) => setFailed(e instanceof Error ? e.message : 'Could not load'));
  }, []);

  if (!data) return <div className={w.page}><p className={w.muted}>{failed || 'Loading…'}</p></div>;

  // What a tile shows: the pick, or the current tile (the default) when nothing is chosen.
  const all = data.library.flatMap((pr) => pr.images.map((im) => ({ ...im, slug: pr.slug, title: pr.title })));
  const shown = (i: number) => {
    const pk = picks[i];
    if (pk) return all.find((im) => im.src === pk.src && im.slug === pk.slug) ?? null;
    return data.tiles[i] ?? null;
  };
  const dirty = JSON.stringify(picks) !== JSON.stringify(data.picks);
  const used = new Set(picks.filter(Boolean).map((pk) => pk!.src));

  function choose(slug: string, src: string) {
    setPicks((cur) => cur.map((pk, i) => (i === slot ? { slug, src } : pk)));
    setSlot((i) => (i + 1) % AREAS.length);
    setNote(null);
  }

  async function save() {
    setSaving(true); setNote(null);
    try {
      const r = await apiSend<{ picks: Pick[]; tiles: Tile[] }>('/api/admin/homepage', 'PATCH', { picks });
      setData((d) => (d ? { ...d, picks: r.picks, tiles: r.tiles } : d));
      setPicks(r.picks);
      setNote({ text: 'Saved. The homepage shows these now.', tone: 'ok' });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'Could not save', tone: 'error' });
    }
    setSaving(false);
  }

  const library = project === 'all' ? data.library : data.library.filter((pr) => pr.slug === project);

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Homepage</h1>
          <p className={w.sub}>The seven photos in the hero collage. Click a tile, then a photo below to put it there. Each tile links to its case study.</p>
        </div>
        <div className={w.headActions}>
          <a className={p.btn} href="/" target="_blank" rel="noreferrer">View page ↗</a>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {note && <p style={{ color: note.tone === 'error' ? 'var(--a-danger)' : '#0a7d4a', margin: '0 0 12px' }}>{note.text}</p>}

      <section className={w.card} style={{ padding: 16, marginBottom: 20 }}>
        <div className={s.grid}>
          {AREAS.split('').map((area, i) => {
            const im = shown(i);
            return (
              <button key={area} type="button" className={`${s.tile} ${slot === i ? s.tileOn : ''}`} style={{ gridArea: area }}
                onClick={() => setSlot(i)} aria-pressed={slot === i} aria-label={`Tile ${i + 1} (${data.shapes[i]})${im ? `: ${im.title}` : ''}`}>
                {im && <img src={im.url} alt="" />}
                <span className={s.tileLabel}>{i + 1} · {data.shapes[i]}{im ? ` · ${im.title}` : ''}{!picks[i] ? ' (default)' : ''}</span>
                {picks[i] && (
                  <span role="button" tabIndex={0} className={s.reset} title="Back to the default photo"
                    onClick={(e) => { e.stopPropagation(); setPicks((cur) => cur.map((pk, k) => (k === i ? null : pk))); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPicks((cur) => cur.map((pk, k) => (k === i ? null : pk))); } }}>↺</span>
                )}
              </button>
            );
          })}
        </div>
        <p className={w.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Tile {slot + 1} ({data.shapes[slot].toLowerCase()}) is selected. On phones the tiles show two to a row.</p>
      </section>

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
