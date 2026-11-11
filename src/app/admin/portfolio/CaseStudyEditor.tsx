'use client';

// The case study behind /work/<slug>, section by section — the same sections
// The Burrell Group's page has (pages with desktop + phone shots, features,
// design system, timeline, phones) plus Growth for social media projects
// (each account's numbers, charts over time and analytics screenshots shown in
// phone frames). Saved to projects.case_study (migration 060), which wins over
// the code file in src/app/work/case-studies/. A project with only a code file
// opens with that file's content; saving moves it here.

import { useEffect, useRef, useState } from 'react';
import ui from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { caseImageUrl } from '@/lib/storage';
import { LineChart } from '@/app/_site/work/Growth';
import { api, directUpload } from './portfolioApi';

// ── Draft types: the CaseStudy shape, but numbers may be half-typed strings ──

type Img = { src: string; alt: string; caption?: string };
type Titled = { title: string; text: string };
type Num = number | string;
type Stat = { label: string; start: Num; end: Num; unit?: string };
type Series = { label: string; unit?: string; points: { when: string; value: Num }[] };
type Account = { platform: string; handle?: string; period?: string; stats: Stat[]; series?: Series[] };
type Draft = {
  client?: string; headline?: string; lede?: string; liveUrl?: string;
  seo?: { title: string; description: string };
  meta?: { label: string; value: string }[];
  heroImage?: Img;
  numbers?: { value: string; label: string }[];
  about?: string[];
  challenge?: { intro: string; goals?: Titled[] };
  approach?: { intro?: string; steps: Titled[] };
  pages?: { title: string; text: string; desktop?: Img; mobile?: Img }[];
  showcase?: { title?: string; text?: string; images: Img[]; layout?: string }[];
  features?: Titled[];
  design?: { intro: string; colors?: { name: string; hex: string }[]; type?: string; patterns?: Titled[]; fullPages?: Img[] };
  timeline?: { when: string; title: string; text: string }[];
  mobile?: { intro: string; shots: Img[] };
  growth?: { intro?: string; accounts: Account[]; screenshots?: Img[]; screenshotsText?: string };
  outcome?: string[];
  quote?: { text: string; author: string };
  related?: { before: string; label: string; href: string; after?: string };
  stack?: string[];
};

type Kind = 'web' | 'social' | 'other';

const T = (n: number): Titled[] => Array.from({ length: n }, () => ({ title: '', text: '' }));
const STAT_NAMES = ['Followers', 'Reach', 'Impressions', 'Engagement rate', 'Profile visits', 'Link clicks', 'Likes', 'Comments', 'Shares', 'Saves', 'Video views', 'Posts published'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube', 'X', 'Pinterest', 'Threads'];

function template(kind: Kind, title: string): Draft {
  if (kind === 'web') {
    return {
      client: title, headline: '', lede: '', liveUrl: '',
      meta: [{ label: 'Client', value: title }, { label: 'Industry', value: '' }, { label: "Thrive's role", value: 'Design and development' }, { label: 'Timeline', value: '' }],
      numbers: [{ value: '', label: 'Public pages' }, { value: '', label: '' }, { value: '', label: '' }],
      about: [''], challenge: { intro: '', goals: T(4) },
      pages: [{ title: 'Home', text: '' }],
      features: T(4),
      design: { intro: '', colors: [{ name: '', hex: '#000000' }], type: '', patterns: T(3), fullPages: [] },
      timeline: [{ when: '', title: 'Launch', text: '' }],
      mobile: { intro: '', shots: [] },
      outcome: [''], stack: ['Next.js', 'Vercel'],
    };
  }
  if (kind === 'social') {
    return {
      client: title, headline: '', lede: '',
      meta: [{ label: 'Client', value: title }, { label: 'Type', value: 'Social media management and graphics' }, { label: "Thrive's role", value: 'Social media manager, graphic designer' }, { label: 'Year', value: String(new Date().getFullYear()) }],
      numbers: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }],
      about: [''], challenge: { intro: '', goals: T(4) },
      approach: { intro: '', steps: T(4) },
      showcase: [{ title: 'Feed posts', text: '', layout: 'posts', images: [] }, { title: 'Stories', text: '', layout: 'phones', images: [] }],
      growth: {
        intro: '',
        accounts: [{
          platform: 'Instagram', handle: '', period: '',
          stats: [{ label: 'Followers', start: '', end: '' }, { label: 'Reach', start: '', end: '' }, { label: 'Engagement rate', start: '', end: '', unit: '%' }, { label: 'Profile visits', start: '', end: '' }],
          series: [{ label: 'Followers', points: [] }],
        }],
        screenshots: [], screenshotsText: '',
      },
      design: { intro: '', colors: [{ name: '', hex: '#000000' }], patterns: T(3) },
      outcome: [''], stack: ['Instagram', 'Canva'],
    };
  }
  return { client: title, headline: '', lede: '', meta: [{ label: 'Client', value: title }], about: [''], outcome: [''] };
}

function kindOf(category: string | null | undefined, cs: Draft | null): Kind {
  if (cs?.growth || /social/i.test(category ?? '')) return 'social';
  if (cs?.pages?.length || /web|website/i.test(category ?? '')) return 'web';
  return 'other';
}

// ── The detail check: what Burrell-level detail means for each kind ──

const filled = (s?: string) => !!s?.trim();
const n = (v: Num) => (typeof v === 'number' ? v : Number(String(v).replace(/[,\s$%]/g, '')));
const ok = (v: Num) => String(v).trim() !== '' && Number.isFinite(n(v));

function checks(d: Draft, kind: Kind): { label: string; done: boolean }[] {
  const base = [
    { label: 'Headline and intro', done: filled(d.headline) && filled(d.lede) },
    { label: 'Main image', done: !!d.heroImage?.src },
    { label: '3+ numbers', done: (d.numbers ?? []).filter((x) => filled(x.value) && filled(x.label)).length >= 3 },
    { label: 'About the client', done: (d.about ?? []).some(filled) },
    { label: 'Challenge with 3+ goals', done: filled(d.challenge?.intro) && (d.challenge?.goals ?? []).filter((g) => filled(g.title)).length >= 3 },
  ];
  const tail = [
    { label: 'Design system (colours + notes)', done: filled(d.design?.intro) && (d.design?.colors ?? []).filter((c) => filled(c.name)).length >= 2 },
    { label: 'Outcome', done: (d.outcome ?? []).some(filled) },
  ];
  if (kind === 'web') {
    const pages = (d.pages ?? []).filter((p) => filled(p.title) && p.desktop?.src);
    return [
      ...base,
      { label: 'Live site link', done: filled(d.liveUrl) },
      { label: '4+ pages with desktop shots', done: pages.length >= 4 },
      { label: 'Every page has a phone shot', done: pages.length > 0 && pages.every((p) => p.mobile?.src) },
      { label: '4+ features', done: (d.features ?? []).filter((f) => filled(f.title)).length >= 4 },
      ...tail,
      { label: 'Type and design patterns', done: filled(d.design?.type) && (d.design?.patterns ?? []).filter((p) => filled(p.title)).length >= 2 },
      { label: 'Full-length page shots', done: (d.design?.fullPages ?? []).length >= 2 },
      { label: '3+ timeline steps', done: (d.timeline ?? []).filter((t) => filled(t.when) && filled(t.title)).length >= 3 },
      { label: '3+ phone views', done: (d.mobile?.shots ?? []).length >= 3 },
      { label: 'Built with', done: (d.stack ?? []).some(filled) },
    ];
  }
  if (kind === 'social') {
    const accounts = d.growth?.accounts ?? [];
    return [
      ...base,
      { label: 'Approach with 3+ steps', done: (d.approach?.steps ?? []).filter((s) => filled(s.title)).length >= 3 },
      { label: '2+ groups of posts', done: (d.showcase ?? []).filter((b) => b.images.length).length >= 2 },
      { label: 'Growth numbers (start → end)', done: accounts.some((a) => a.stats.filter((s) => filled(s.label) && ok(s.start) && ok(s.end)).length >= 2) },
      { label: 'A growth chart (3+ points)', done: accounts.some((a) => (a.series ?? []).some((s) => s.points.filter((p) => filled(p.when) && ok(p.value)).length >= 3)) },
      { label: '2+ analytics screenshots', done: (d.growth?.screenshots ?? []).length >= 2 },
      ...tail,
    ];
  }
  return [...base, ...tail];
}

// ── Small UI pieces ──

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid var(--a-border-strong)',
  borderRadius: 10, padding: '8px 10px', fontFamily: 'var(--a-font)', fontSize: 13.5, color: 'var(--a-text)', outline: 'none',
};
const area: React.CSSProperties = { ...input, minHeight: 72, resize: 'vertical', lineHeight: 1.55 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 };
const rowBox: React.CSSProperties = { border: '1px solid var(--a-border)', borderRadius: 14, padding: 12, marginBottom: 10, background: '#fff' };
const grid = (min = 180): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 });

function Txt({ l, v, set, ph, list }: { l?: string; v?: string; set: (v: string) => void; ph?: string; list?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      {l && <span style={label}>{l}</span>}
      <input style={input} value={v ?? ''} placeholder={ph} list={list} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function Area({ l, v, set, ph, rows }: { l?: string; v?: string; set: (v: string) => void; ph?: string; rows?: number }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      {l && <span style={label}>{l}</span>}
      <textarea style={{ ...area, minHeight: (rows ?? 3) * 24 }} value={v ?? ''} placeholder={ph} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
/** Paragraphs as one box, blank line between them. */
function Paras({ l, v, set, ph }: { l?: string; v?: string[]; set: (v: string[]) => void; ph?: string }) {
  const [text, setText] = useState((v ?? []).join('\n\n'));
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      {l && <span style={label}>{l}</span>}
      <textarea style={{ ...area, minHeight: 110 }} value={text} placeholder={ph}
        onChange={(e) => { setText(e.target.value); set(e.target.value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)); }} />
      <span style={{ fontSize: 11.5, color: 'var(--a-faint)' }}>Leave a blank line between paragraphs.</span>
    </label>
  );
}

function move<T>(list: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Rows<T>({ items, set, blank, add, render, inline }: {
  items: T[] | undefined; set: (v: T[]) => void; blank: () => T; add: string;
  render: (item: T, update: (v: T) => void, i: number) => React.ReactNode; inline?: boolean;
}) {
  const list = items ?? [];
  return (
    <div>
      {list.map((item, i) => (
        <div key={i} style={inline ? { display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 } : rowBox}>
          <div style={{ flex: 1, minWidth: 0 }}>{render(item, (v) => set(list.map((x, k) => (k === i ? v : x))), i)}</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: inline ? 0 : 4 }}>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(move(list, i, -1))} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(move(list, i, 1))} disabled={i === list.length - 1} aria-label="Move down">↓</button>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(list.filter((_, k) => k !== i))} aria-label="Remove">✕</button>
          </div>
        </div>
      ))}
      <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set([...list, blank()])}>+ {add}</button>
    </div>
  );
}

function Section({ title, hint, done, children, open }: { title: string; hint?: string; done?: boolean; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} style={{ borderTop: '1px solid var(--a-border)', padding: '12px 0' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: done ? '#0cf574' : 'var(--a-border-strong)', flexShrink: 0 }} />
        {title}
      </summary>
      <div style={{ paddingTop: 12 }}>
        {hint && <p style={{ fontSize: 12.5, color: 'var(--a-muted)', margin: '0 0 12px' }}>{hint}</p>}
        {children}
      </div>
    </details>
  );
}

// ── Images ──

type Uploader = (files: File[]) => Promise<string[]>;

function Preview({ src, phone }: { src: string; phone?: boolean }) {
  const url = caseImageUrl(src, 480);
  const style: React.CSSProperties = phone
    ? { width: 90, aspectRatio: '9 / 19.5', objectFit: 'cover', objectPosition: 'top', borderRadius: 14, border: '4px solid #141414', background: '#141414', display: 'block' }
    : { width: 150, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--a-border)', display: 'block', background: 'var(--a-surface-2)' };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return <video src={url} muted playsInline style={style} />;
  return <img src={url} alt="" style={style} />;
}

function ImagePick({ l, v, set, upload, phone, caption }: {
  l?: string; v?: Img; set: (v: Img | undefined) => void; upload: Uploader; phone?: boolean; caption?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { const [src] = await upload([f]); set({ alt: v?.alt ?? '', ...v, src }); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <div style={{ marginBottom: 10 }}>
      {l && <span style={label}>{l}</span>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {v?.src ? <Preview src={v.src} phone={phone} /> : (
          <div style={{ width: phone ? 90 : 150, height: phone ? 190 : 96, borderRadius: phone ? 14 : 8, border: '1.5px dashed var(--a-border-strong)', display: 'grid', placeItems: 'center', fontSize: 11.5, color: 'var(--a-faint)', textAlign: 'center', padding: 6 }}>
            {phone ? 'Phone screenshot' : 'No image'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 180 }}>
          <input ref={ref} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={pick} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : v?.src ? 'Replace' : 'Upload'}</button>
            {v?.src && <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(undefined)}>Remove</button>}
          </div>
          {v?.src && (
            <>
              <input style={{ ...input, marginBottom: 6 }} value={v.alt} placeholder="Describe the image (for screen readers and Google)" onChange={(e) => set({ ...v, alt: e.target.value })} />
              {caption && <input style={input} value={v.caption ?? ''} placeholder="Caption (optional)" onChange={(e) => set({ ...v, caption: e.target.value })} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageList({ v, set, upload, phone, caption, add = 'Add images' }: {
  v?: Img[]; set: (v: Img[]) => void; upload: Uploader; phone?: boolean; caption?: boolean; add?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const list = v ?? [];
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const srcs = await upload(files);
      set([...list, ...srcs.map((src) => ({ src, alt: '' }))]);
    } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <div>
      {list.map((img, i) => (
        <div key={img.src + i} style={{ ...rowBox, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ImagePick v={img} phone={phone} caption={caption} upload={upload}
              set={(x) => set(x ? list.map((y, k) => (k === i ? x : y)) : list.filter((_, k) => k !== i))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(move(list, i, -1))} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(move(list, i, 1))} disabled={i === list.length - 1} aria-label="Move down">↓</button>
          </div>
        </div>
      ))}
      <input ref={ref} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={pick} />
      <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : `+ ${add}`}</button>
    </div>
  );
}

// ── Growth: one account ──

function pointsText(points: Series['points']) {
  return points.map((p) => `${p.when} | ${p.value}`).join('\n');
}
function parsePoints(text: string): Series['points'] {
  return text.split('\n').map((line) => {
    const parts = line.split(/\s*[|\t]\s*/);
    if (parts.length < 2) return null;
    const value = parts[parts.length - 1].trim();
    const when = parts.slice(0, -1).join(' ').trim();
    return when && value ? { when, value } : null;
  }).filter((x): x is { when: string; value: string } => !!x);
}

function SeriesEditor({ s, set }: { s: Series; set: (v: Series) => void }) {
  const [text, setText] = useState(pointsText(s.points));
  const clean = s.points.filter((p) => ok(p.value)).map((p) => ({ when: p.when, value: n(p.value) }));
  return (
    <div>
      <div style={grid(140)}>
        <Txt l="Chart of" v={s.label} set={(label) => set({ ...s, label })} ph="Followers" list="growth-stats" />
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={label}>Unit</span>
          <select style={input} value={s.unit ?? ''} onChange={(e) => set({ ...s, unit: e.target.value || undefined })}>
            <option value="">Number</option><option value="%">Percent</option><option value="$">Dollars</option>
          </select>
        </label>
      </div>
      <Area l="Points — one per line: when | number" rows={5} v={text} ph={'Jan | 412\nFeb | 530\nMar | 688'}
        set={(t) => { setText(t); set({ ...s, points: parsePoints(t) }); }} />
      {clean.length >= 2 ? (
        <div style={{ maxWidth: 520 }}><LineChart series={{ label: `Preview: ${s.label || 'chart'}`, unit: s.unit, points: clean }} /></div>
      ) : <p style={{ fontSize: 12, color: 'var(--a-faint)', margin: 0 }}>Add two or more points to see the chart.</p>}
    </div>
  );
}

function AccountEditor({ a, set }: { a: Account; set: (v: Account) => void }) {
  return (
    <div>
      <div style={grid(150)}>
        <Txt l="Platform" v={a.platform} set={(platform) => set({ ...a, platform })} list="growth-platforms" />
        <Txt l="Handle" v={a.handle} set={(handle) => set({ ...a, handle })} ph="@client" />
        <Txt l="Period" v={a.period} set={(period) => set({ ...a, period })} ph="Jan – Jun 2026" />
      </div>
      <span style={label}>Numbers (start → end)</span>
      <Rows inline items={a.stats} set={(stats) => set({ ...a, stats })} add="Number" blank={() => ({ label: '', start: '', end: '' })}
        render={(st, up) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 2fr) 1fr 1fr 90px', gap: 6 }}>
            <input style={input} value={st.label} placeholder="Followers" list="growth-stats" onChange={(e) => up({ ...st, label: e.target.value })} />
            <input style={input} value={String(st.start)} placeholder="Start" inputMode="decimal" onChange={(e) => up({ ...st, start: e.target.value })} />
            <input style={input} value={String(st.end)} placeholder="End" inputMode="decimal" onChange={(e) => up({ ...st, end: e.target.value })} />
            <select style={input} value={st.unit ?? ''} onChange={(e) => up({ ...st, unit: e.target.value || undefined })} aria-label="Unit">
              <option value="">#</option><option value="%">%</option><option value="$">$</option>
            </select>
          </div>
        )} />
      <div style={{ marginTop: 14 }}>
        <span style={label}>Charts over time</span>
        <Rows items={a.series} set={(series) => set({ ...a, series })} add="Chart" blank={() => ({ label: '', points: [] })}
          render={(se, up) => <SeriesEditor s={se} set={up} />} />
      </div>
    </div>
  );
}

// ── The editor ──

export default function CaseStudyEditor({ projectId, slug, title, category, onMsg }: {
  projectId: string; slug: string; title: string; category: string | null;
  onMsg: (m: { type: 'ok' | 'err'; text: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'saved' | 'file' | 'none'>('none');
  const [hasFile, setHasFile] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kind, setKind] = useState<Kind>('other');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api('get_case_study', { slug });
        const d = res.data as { saved: Draft | null; file: Draft | null; needsMigration: boolean };
        if (!live) return;
        const cs = d.saved ?? d.file ?? null;
        setDraft(cs ? structuredClone(cs) : null);
        setSource(d.saved ? 'saved' : d.file ? 'file' : 'none');
        setHasFile(!!d.file);
        setNeedsMigration(d.needsMigration);
        setKind(kindOf(category, cs));
        setDirty(false);
        setVersion((v) => v + 1);
      } catch (e) {
        onMsg({ type: 'err', text: (e as Error).message });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const upload: Uploader = async (files) => {
    const out: string[] = [];
    for (const f of files) {
      const name = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const path = await directUpload(f, `projects/${slug}/case/${name}`, true);
      out.push(`storage:${path}`);
    }
    return out;
  };

  function up<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...(d ?? {}), [k]: v }));
    setDirty(true);
  }

  async function save(value: Draft | null) {
    setSaving(true);
    try {
      await api('save_case_study', { id: projectId, slug, case_study: value });
      if (value) { setSource('saved'); onMsg({ type: 'ok', text: 'Case study saved — it’s live on the project page.' }); }
      else {
        onMsg({ type: 'ok', text: hasFile ? 'Removed the saved copy; the page uses the code file again.' : 'Case study removed.' });
        const res = await api('get_case_study', { slug });
        const d = res.data as { file: Draft | null };
        setDraft(d.file ? structuredClone(d.file) : null);
        setSource(d.file ? 'file' : 'none');
        setVersion((v) => v + 1);
      }
      setDirty(false);
    } catch (e) {
      onMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={w.muted} style={{ fontSize: 13 }}>Loading the case study…</p>;

  if (!draft) {
    return (
      <div>
        <p style={{ fontSize: 13.5, margin: '0 0 12px' }}>
          No case study yet, so /work/{slug} shows the short layout. Start one — it opens with every section a full case study has:
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['web', 'Website development'], ['social', 'Social media'], ['other', 'Other (branding, UX, photos)']] as [Kind, string][]).map(([k, l]) => (
            <button key={k} type="button" className={`${ui.btn} ${k === kindOf(category, null) ? ui.btnPrimary : ''}`}
              onClick={() => { setDraft(template(k, title)); setKind(k); setDirty(true); setVersion((v) => v + 1); }}>{l}</button>
          ))}
        </div>
      </div>
    );
  }

  const d = draft;
  const list = checks(d, kind);
  const doneCount = list.filter((c) => c.done).length;
  const has = (k: keyof Draft) => d[k] !== undefined;
  const isDone = (l: string) => list.find((c) => c.label === l)?.done;

  return (
    <div key={version}>
      <datalist id="growth-stats">{STAT_NAMES.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="growth-platforms">{PLATFORMS.map((x) => <option key={x} value={x} />)}</datalist>

      {needsMigration && (
        <p style={{ background: '#fd6100', color: '#141414', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
          Run migration 060 (supabase/migrations/060_case_study_json.sql) in Supabase before saving.
        </p>
      )}
      {source === 'file' && (
        <p style={{ background: 'var(--a-surface-2)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          This case study comes from the code file. Edit it here and save to take it over; the file stays as a backup.
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 10px' }}>
        <span style={label}>Kind</span>
        {(['web', 'social', 'other'] as Kind[]).map((k) => (
          <button key={k} type="button" className={`${ui.btn} ${ui.btnSmall} ${kind === k ? ui.btnPrimary : ''}`} onClick={() => setKind(k)}>
            {k === 'web' ? 'Website development' : k === 'social' ? 'Social media' : 'Other'}
          </button>
        ))}
      </div>

      {/* Detail check */}
      <div style={{ border: '1.5px solid #141414', borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Detail check</strong>
          <span className={w.pill} style={{ background: doneCount === list.length ? '#0cf574' : '#141414', color: doneCount === list.length ? '#141414' : '#fff' }}>
            {doneCount} of {list.length}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--a-muted)', margin: '0 0 8px' }}>
          {kind === 'web' ? 'What The Burrell Group’s page has.' : kind === 'social' ? 'A full social case study: the posts, the growth and the proof.' : 'The basics every case study has.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {list.map((c) => (
            <span key={c.label} className={w.pill} style={c.done ? { background: '#0cf574', color: '#141414' } : { background: '#fff', color: 'var(--a-muted)', boxShadow: 'inset 0 0 0 1.5px var(--a-border-strong)' }}>
              {c.done ? '✓ ' : ''}{c.label}
            </span>
          ))}
        </div>
      </div>

      <Section title="Header" open done={isDone('Headline and intro')} hint="The project name, a one-line headline and the intro paragraph at the top of the page.">
        <div style={grid(220)}>
          <Txt l="Client / project name" v={d.client} set={(v) => up('client', v)} />
          <Txt l="Live link" v={d.liveUrl} set={(v) => up('liveUrl', v)} ph={kind === 'social' ? 'https://www.instagram.com/…' : 'https://…'} />
        </div>
        <Txt l="Headline" v={d.headline} set={(v) => up('headline', v)} ph={kind === 'social' ? 'A feed that looks like one brand and posts on a rhythm' : 'A website as credible as the programs it supports'} />
        <Area l="Intro" v={d.lede} set={(v) => up('lede', v)} rows={4} />
        <span style={label}>At a glance (the coloured boxes under the cover)</span>
        <Rows inline items={d.meta} set={(v) => up('meta', v)} add="Detail" blank={() => ({ label: '', value: '' })}
          render={(m, u) => (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
              <input style={input} value={m.label} placeholder="Industry" onChange={(e) => u({ ...m, label: e.target.value })} />
              <input style={input} value={m.value} placeholder="Value" onChange={(e) => u({ ...m, value: e.target.value })} />
            </div>
          )} />
        <div style={{ ...grid(220), marginTop: 12 }}>
          <Txt l="Search title (optional)" v={d.seo?.title} set={(v) => up('seo', { title: v, description: d.seo?.description ?? '' })} />
          <Txt l="Search description (optional)" v={d.seo?.description} set={(v) => up('seo', { title: d.seo?.title ?? '', description: v })} />
        </div>
      </Section>

      <Section title="Main image" done={!!d.heroImage?.src} hint="The big image under the overview — a mockup of the work works best.">
        <ImagePick v={d.heroImage} set={(v) => up('heroImage', v)} upload={upload} />
      </Section>

      <Section title="The project" done={isDone('About the client') && isDone('3+ numbers')} hint="Who the client is, and the big numbers beside it. Only real, countable numbers.">
        <Paras l="About" v={d.about} set={(v) => up('about', v)} />
        <span style={label}>Numbers</span>
        <Rows inline items={d.numbers} set={(v) => up('numbers', v)} add="Number" blank={() => ({ value: '', label: '' })}
          render={(m, u) => (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
              <input style={input} value={m.value} placeholder="+800%" onChange={(e) => u({ ...m, value: e.target.value })} />
              <input style={input} value={m.label} placeholder="Site engagement" onChange={(e) => u({ ...m, label: e.target.value })} />
            </div>
          )} />
      </Section>

      <Section title="The challenge" done={isDone('Challenge with 3+ goals')}>
        <Area l="Intro" v={d.challenge?.intro} set={(v) => up('challenge', { ...(d.challenge ?? { intro: '' }), intro: v })} rows={3} />
        <span style={label}>Goals</span>
        <Rows items={d.challenge?.goals} set={(v) => up('challenge', { intro: d.challenge?.intro ?? '', goals: v })} add="Goal" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Goal" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
      </Section>

      <Section title="The approach" done={(d.approach?.steps ?? []).some((s) => filled(s.title))} hint={kind === 'web' ? 'Optional for websites — the pages and features usually tell this.' : 'The steps, in order.'}>
        <Area l="Intro (optional)" v={d.approach?.intro} set={(v) => up('approach', { steps: d.approach?.steps ?? [], intro: v })} rows={2} />
        <Rows items={d.approach?.steps} set={(v) => up('approach', { intro: d.approach?.intro, steps: v })} add="Step" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Step" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
      </Section>

      {(kind === 'web' || has('pages')) && (
        <Section title="The pages" done={isDone('4+ pages with desktop shots') && isDone('Every page has a phone shot')} hint="Each page of the site: what it does, a desktop screenshot (shown in a browser frame) and a phone screenshot (shown in a phone frame beside it).">
          <Rows<NonNullable<Draft['pages']>[number]> items={d.pages} set={(v) => up('pages', v)} add="Page" blank={() => ({ title: '', text: '' })}
            render={(pg, u) => (
              <>
                <Txt v={pg.title} set={(t) => u({ ...pg, title: t })} ph="Page name" />
                <Area v={pg.text} set={(t) => u({ ...pg, text: t })} rows={3} ph="What's on it and why" />
                <div style={grid(260)}>
                  <ImagePick l="Desktop screenshot" v={pg.desktop} set={(x) => u({ ...pg, desktop: x })} upload={upload} />
                  <ImagePick l="Phone screenshot" v={pg.mobile} set={(x) => u({ ...pg, mobile: x })} upload={upload} phone />
                </div>
              </>
            )} />
        </Section>
      )}

      {(kind === 'social' || has('growth')) && (
        <Section title="The growth" done={isDone('Growth numbers (start → end)') && isDone('A growth chart (3+ points)') && isDone('2+ analytics screenshots')}
          hint="Each account's numbers from the start of the work to now (shown with the change and %), charts over time, and analytics screenshots shown in phone frames. Use the real numbers from Insights.">
          <Area l="Intro (optional)" v={d.growth?.intro} rows={2} set={(v) => up('growth', { accounts: [], ...d.growth, intro: v })} />
          <Rows items={d.growth?.accounts} set={(v) => up('growth', { ...d.growth, accounts: v })} add="Account"
            blank={() => ({ platform: 'Instagram', stats: [{ label: 'Followers', start: '', end: '' }], series: [] })}
            render={(a, u) => <AccountEditor a={a} set={u} />} />
          <div style={{ marginTop: 16 }}>
            <span style={label}>Analytics screenshots (shown in phone frames)</span>
            <Area v={d.growth?.screenshotsText} rows={2} ph="A line above the screenshots (optional)" set={(v) => up('growth', { accounts: [], ...d.growth, screenshotsText: v })} />
            <ImageList v={d.growth?.screenshots} phone caption add="Upload screenshots" upload={upload}
              set={(v) => up('growth', { accounts: [], ...d.growth, screenshots: v })} />
          </div>
        </Section>
      )}

      <Section title="The work" done={(d.showcase ?? []).some((b) => b.images.length)} hint="Groups of images. Layouts: grid, wide (one per row), posts (social posts), phones (phone frames — stories, reels, app screens).">
        <Rows items={d.showcase} set={(v) => up('showcase', v)} add="Group" blank={() => ({ title: '', text: '', layout: kind === 'social' ? 'posts' : 'grid', images: [] })}
          render={(b, u) => (
            <>
              <div style={grid(180)}>
                <Txt v={b.title} set={(t) => u({ ...b, title: t })} ph="Title (optional)" />
                <select style={{ ...input, marginBottom: 10 }} value={b.layout ?? 'grid'} onChange={(e) => u({ ...b, layout: e.target.value })} aria-label="Layout">
                  <option value="grid">Grid</option><option value="wide">Wide</option><option value="posts">Posts</option><option value="phones">Phones</option>
                </select>
              </div>
              <Area v={b.text} set={(t) => u({ ...b, text: t })} rows={2} ph="A line about this group (optional)" />
              <ImageList v={b.images} set={(x) => u({ ...b, images: x })} upload={upload} phone={b.layout === 'phones'} caption={b.layout !== 'phones'} />
            </>
          )} />
      </Section>

      <Section title="Features" done={(d.features ?? []).filter((f) => filled(f.title)).length >= (kind === 'web' ? 4 : 1)}>
        <Rows items={d.features} set={(v) => up('features', v)} add="Feature" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Feature" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
      </Section>

      <Section title="Design system" done={isDone('Design system (colours + notes)')}>
        <Area l="Intro" v={d.design?.intro} rows={2} set={(v) => up('design', { ...(d.design ?? {}), intro: v })} />
        <span style={label}>Colours</span>
        <Rows inline items={d.design?.colors} set={(v) => up('design', { intro: '', ...d.design, colors: v })} add="Colour" blank={() => ({ name: '', hex: '#000000' })}
          render={(c, u) => (
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 110px', gap: 6, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#000000'} onChange={(e) => u({ ...c, hex: e.target.value })} style={{ width: 44, height: 36, border: 0, background: 'none', padding: 0 }} aria-label="Pick colour" />
              <input style={input} value={c.name} placeholder="Name" onChange={(e) => u({ ...c, name: e.target.value })} />
              <input style={input} value={c.hex} onChange={(e) => u({ ...c, hex: e.target.value })} aria-label="Hex" />
            </div>
          )} />
        <div style={{ marginTop: 12 }}><Area l="Type" v={d.design?.type} rows={2} set={(v) => up('design', { intro: '', ...d.design, type: v })} /></div>
        <span style={label}>Patterns</span>
        <Rows items={d.design?.patterns} set={(v) => up('design', { intro: '', ...d.design, patterns: v })} add="Pattern" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Pattern" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
        {(kind === 'web' || (d.design?.fullPages ?? []).length > 0) && (
          <div style={{ marginTop: 12 }}>
            <span style={label}>Full-length page screenshots</span>
            <ImageList v={d.design?.fullPages} caption upload={upload} set={(v) => up('design', { intro: '', ...d.design, fullPages: v })} />
          </div>
        )}
      </Section>

      {(kind === 'web' || has('mobile')) && (
        <Section title="On phones" done={isDone('3+ phone views')} hint="Phone screenshots, shown in phone frames.">
          <Area l="Intro" v={d.mobile?.intro} rows={2} set={(v) => up('mobile', { shots: d.mobile?.shots ?? [], intro: v })} />
          <ImageList v={d.mobile?.shots} phone upload={upload} add="Upload phone screenshots" set={(v) => up('mobile', { intro: d.mobile?.intro ?? '', shots: v })} />
        </Section>
      )}

      <Section title="Timeline" done={(d.timeline ?? []).filter((t) => filled(t.title)).length >= 3}>
        <Rows items={d.timeline} set={(v) => up('timeline', v)} add="Step" blank={() => ({ when: '', title: '', text: '' })}
          render={(t, u) => (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 6, marginBottom: 6 }}>
                <input style={input} value={t.when} placeholder="Jan 2026" onChange={(e) => u({ ...t, when: e.target.value })} />
                <input style={input} value={t.title} placeholder="Launch" onChange={(e) => u({ ...t, title: e.target.value })} />
              </div>
              <Area v={t.text} set={(x) => u({ ...t, text: x })} rows={2} />
            </>
          )} />
      </Section>

      <Section title="The outcome" done={isDone('Outcome')} hint="Leave the quote empty until the client has given one.">
        <Paras v={d.outcome} set={(v) => up('outcome', v)} />
        <div style={grid(220)}>
          <Area l="Client quote" v={d.quote?.text} rows={2} set={(v) => up('quote', { author: d.quote?.author ?? '', text: v })} />
          <Txt l="Quote by" v={d.quote?.author} set={(v) => up('quote', { text: d.quote?.text ?? '', author: v })} />
        </div>
        <Txt l="Built with (comma-separated)" v={(d.stack ?? []).join(', ')} set={(v) => up('stack', v.split(',').map((x) => x.trim()))} />
        <span style={label}>A sentence with a link (optional)</span>
        <div style={grid(150)}>
          <Txt v={d.related?.before} ph="Text before" set={(v) => up('related', { label: '', href: '', ...d.related, before: v })} />
          <Txt v={d.related?.label} ph="Link words" set={(v) => up('related', { before: '', href: '', ...d.related, label: v })} />
          <Txt v={d.related?.href} ph="/amarillo-web-design" set={(v) => up('related', { before: '', label: '', ...d.related, href: v })} />
          <Txt v={d.related?.after} ph="Text after" set={(v) => up('related', { before: '', label: '', href: '', ...d.related, after: v })} />
        </div>
      </Section>

      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid var(--a-border)', padding: '12px 0', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', zIndex: 2 }}>
        {source === 'saved' ? (
          <button type="button" className={`${ui.btn} ${ui.btnDanger}`} disabled={saving}
            onClick={() => { if (confirm(hasFile ? 'Remove the saved case study? The page goes back to the code file.' : 'Remove the case study? The page goes back to the short layout.')) save(null); }}>
            {hasFile ? 'Use the code file again' : 'Remove case study'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span className={w.muted} style={{ fontSize: 12 }}>Unsaved changes</span>}
          <a href={`/work/${slug}`} target="_blank" rel="noreferrer" className={ui.btn}>View page</a>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} disabled={saving || needsMigration} onClick={() => save(d)}>
            {saving ? 'Saving…' : 'Save case study'}
          </button>
        </div>
      </div>
    </div>
  );
}
