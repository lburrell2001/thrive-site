'use client';

// The case study behind /work/<slug>, section by section — the same sections
// The Burrell Group's page has (pages with desktop + phone shots, features,
// design system, timeline, phones) plus Growth for social media projects
// (each account's numbers, charts over time and analytics screenshots shown in
// phone frames). Saved to projects.case_study (migration 060), which wins over
// the code file in src/app/work/case-studies/. A project with only a code file
// opens with that file's content; saving moves it here.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import ui from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { caseImageUrl } from '@/lib/storage';
import { LineChart } from '@/app/_site/work/Growth';
import { api, directUpload } from './portfolioApi';

// ── Draft types: the CaseStudy shape, but numbers may be half-typed strings ──

type Img = { src: string; alt: string; caption?: string };
type Titled = { title: string; text: string };
type Num = number | string;
type Stat = { label: string; start: Num; end: Num; unit?: string; lead?: 'percent' | 'gain' | 'end' };
type Side = { followers: Num; nonFollowers: Num };
type Split = { label: string; start: Side; end: Side; unit?: '%' };
type Series = { label: string; unit?: string; points: { when: string; value: Num }[] };
type Account = { platform: string; handle?: string; period?: string; stats: Stat[]; series?: Series[]; splits?: Split[]; startLabel?: string; endLabel?: string };
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
const STAT_NAMES = ['Followers', 'Accounts reached', 'Views', 'Interactions', 'Accounts engaged', 'Engagement rate', 'Profile visits', 'Link clicks', 'Reel plays', 'Likes', 'Comments', 'Shares', 'Saves', 'Impressions', 'Posts published'];
/** What Instagram Insights reports for a period, in the order that sells best. Blank rows are dropped on save. */
const USUAL_STATS: Stat[] = [
  { label: 'Followers', start: '', end: '', lead: 'gain' },
  { label: 'Accounts reached', start: '', end: '' },
  { label: 'Views', start: '', end: '' },
  { label: 'Interactions', start: '', end: '' },
  { label: 'Engagement rate', start: '', end: '', unit: '%' },
  { label: 'Profile visits', start: '', end: '' },
  { label: 'Link clicks', start: '', end: '' },
  { label: 'Shares', start: '', end: '' },
  { label: 'Saves', start: '', end: '' },
];
const SPLIT_NAMES = ['Interactions', 'Views', 'Accounts reached', 'Accounts engaged'];
const blankSplit = (label: string): Split => ({ label, start: { followers: '', nonFollowers: '' }, end: { followers: '', nonFollowers: '' }, unit: '%' });
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
      showcase: [{ title: 'Posts', text: '', layout: 'posts', images: [] }, { title: 'Reels', text: '', layout: 'phones', images: [] }],
      growth: {
        intro: '',
        accounts: [{
          platform: 'Instagram', handle: '', period: '',
          stats: USUAL_STATS.map((x) => ({ ...x })),
          splits: [blankSplit('Interactions'), blankSplit('Views')],
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

/** True when nothing has been typed or uploaded: blank strings, empty lists, and the starter labels only. */
function untouched(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return false;
  if (Array.isArray(v)) return v.every(untouched);
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).every(([k, x]) => ['label', 'title', 'layout', 'platform', 'unit', 'lead', 'name', 'hex'].includes(k) || untouched(x));
  }
  return true;
}

/** Switching kind: every part still untouched takes the new kind's starter; anything typed stays. */
function switchTemplate(d: Draft, to: Kind, title: string): Draft {
  const t = template(to, title);
  const next: Draft = { ...d };
  for (const k of Object.keys(t) as (keyof Draft)[]) {
    if (k === 'client' || k === 'headline' || k === 'lede' || k === 'liveUrl') continue;
    if (k === 'meta') {
      // Keep typed values; swap the starter rows (same labels across kinds) to the new kind's wording.
      const starters = new Set((['web', 'social', 'other'] as Kind[]).flatMap((x) => (template(x, title).meta ?? []).map((m) => `${m.label}|${m.value}`)));
      const typed = (d.meta ?? []).filter((m) => m.value.trim() && !starters.has(`${m.label}|${m.value}`) && m.label !== 'Client');
      const labels = new Set(typed.map((m) => m.label));
      next.meta = [...(t.meta ?? []).filter((m) => !labels.has(m.label)), ...typed];
      continue;
    }
    if (untouched(d[k])) (next as Record<string, unknown>)[k] = t[k];
  }
  // The other kind's untouched parts go, so they don't show up as empty sections.
  for (const k of Object.keys(next) as (keyof Draft)[]) {
    if (!(k in t) && untouched(next[k]) && !['client', 'headline', 'lede', 'liveUrl', 'seo', 'heroImage', 'quote', 'related'].includes(k)) delete next[k];
  }
  return next;
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

function checks(d: Draft, kind: Kind): { label: string; done: boolean; section: SectionId }[] {
  const base = [
    { label: 'Headline and intro', section: 'header' as SectionId, done: filled(d.headline) && filled(d.lede) },
    { label: 'Main image', section: 'hero' as SectionId, done: !!d.heroImage?.src },
    { label: '3+ numbers', section: 'project' as SectionId, done: (d.numbers ?? []).filter((x) => filled(x.value) && filled(x.label)).length >= 3 },
    { label: 'About the client', section: 'project' as SectionId, done: (d.about ?? []).some(filled) },
    { label: 'Challenge with 3+ goals', section: 'challenge' as SectionId, done: filled(d.challenge?.intro) && (d.challenge?.goals ?? []).filter((g) => filled(g.title)).length >= 3 },
  ];
  const tail = [
    { label: 'Design system (colours + notes)', section: 'design' as SectionId, done: filled(d.design?.intro) && (d.design?.colors ?? []).filter((c) => filled(c.name)).length >= 2 },
    { label: 'Outcome', section: 'outcome' as SectionId, done: (d.outcome ?? []).some(filled) },
  ];
  if (kind === 'web') {
    const pages = (d.pages ?? []).filter((p) => filled(p.title) && p.desktop?.src);
    return [
      ...base,
      { label: 'Live site link', section: 'header' as SectionId, done: filled(d.liveUrl) },
      { label: '4+ pages with desktop shots', section: 'pages' as SectionId, done: pages.length >= 4 },
      { label: 'Every page has a phone shot', section: 'pages' as SectionId, done: pages.length > 0 && pages.every((p) => p.mobile?.src) },
      { label: '4+ features', section: 'features' as SectionId, done: (d.features ?? []).filter((f) => filled(f.title)).length >= 4 },
      { label: 'Outcome', section: 'outcome' as SectionId, done: (d.outcome ?? []).some(filled) },
      { label: 'Type and design patterns', section: 'design' as SectionId, done: filled(d.design?.type) && (d.design?.patterns ?? []).filter((p) => filled(p.title)).length >= 2 },
      { label: 'Full-length page shots', section: 'design' as SectionId, done: (d.design?.fullPages ?? []).length >= 2 },
      { label: '3+ timeline steps', section: 'timeline' as SectionId, done: (d.timeline ?? []).filter((t) => filled(t.when) && filled(t.title)).length >= 3 },
      { label: '3+ phone views', section: 'mobile' as SectionId, done: (d.mobile?.shots ?? []).length >= 3 },
      { label: 'Built with', section: 'outcome' as SectionId, done: (d.stack ?? []).some(filled) },
    ];
  }
  if (kind === 'social') {
    const accounts = d.growth?.accounts ?? [];
    return [
      ...base,
      { label: 'Approach with 3+ steps', section: 'approach' as SectionId, done: (d.approach?.steps ?? []).filter((s) => filled(s.title)).length >= 3 },
      { label: '2+ groups of posts', section: 'work' as SectionId, done: (d.showcase ?? []).filter((b) => b.images.length).length >= 2 },
      { label: 'Growth numbers (start → end)', section: 'growth' as SectionId, done: accounts.some((a) => a.stats.filter((s) => filled(s.label) && ok(s.start) && ok(s.end)).length >= 2) },
      { label: 'Followers vs non-followers', section: 'growth' as SectionId, done: accounts.some((a) => (a.splits ?? []).some((sp) => [sp.start.followers, sp.start.nonFollowers, sp.end.followers, sp.end.nonFollowers].every(ok))) },
      { label: 'A growth chart (3+ points)', section: 'growth' as SectionId, done: accounts.some((a) => (a.series ?? []).some((s) => s.points.filter((p) => filled(p.when) && ok(p.value)).length >= 3)) },
      { label: '2+ analytics screenshots', section: 'growth' as SectionId, done: (d.growth?.screenshots ?? []).length >= 2 },
      { label: 'Outcome', section: 'outcome' as SectionId, done: (d.outcome ?? []).some(filled) },
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

type SectionId = 'header' | 'hero' | 'project' | 'challenge' | 'approach' | 'pages' | 'growth' | 'work' | 'features' | 'design' | 'mobile' | 'timeline' | 'outcome';
const OpenCtx = createContext<{ open: Set<SectionId>; toggle: (id: SectionId) => void }>({ open: new Set(), toggle: () => {} });

function Section({ id, title, hint, done, children }: { id: SectionId; title: string; hint?: string; done?: boolean; children: React.ReactNode }) {
  const { open, toggle } = useContext(OpenCtx);
  const isOpen = open.has(id);
  return (
    <section id={`cs-${id}`} style={{ borderTop: '1px solid var(--a-border)', padding: '4px 0', scrollMarginTop: 16 }}>
      <button type="button" onClick={() => toggle(id)} aria-expanded={isOpen}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: done ? '#0cf574' : 'var(--a-border-strong)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{title}</span>
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>+</span>
      </button>
      {isOpen && (
        <div style={{ padding: '4px 0 14px' }}>
          {hint && <p style={{ fontSize: 12.5, color: 'var(--a-muted)', margin: '0 0 12px' }}>{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

// ── Images ──

type Uploader = (files: File[]) => Promise<string[]>;

function uploadError(x: unknown) {
  const m = (x as Error)?.message ?? '';
  if (/413|too large|exceeded/i.test(m)) return 'That file is too big to upload. Export the reel smaller (1080p MP4 works well) and try again.';
  return `Upload didn’t work: ${m || 'try again'}`;
}

function Preview({ src, phone }: { src: string; phone?: boolean }) {
  const url = caseImageUrl(src, 480);
  const style: React.CSSProperties = phone
    ? { width: 90, aspectRatio: '9 / 19.5', objectFit: 'cover', objectPosition: 'top', borderRadius: 14, border: '4px solid #141414', background: '#141414', display: 'block' }
    : { width: 150, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--a-border)', display: 'block', background: 'var(--a-surface-2)' };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return <video src={`${url}#t=0.1`} muted playsInline preload="metadata" style={style} />;
  return <img src={url} alt="" style={style} />;
}

function ImagePick({ l, v, set, upload, phone, caption }: {
  l?: string; v?: Img; set: (v: Img | undefined) => void; upload: Uploader; phone?: boolean; caption?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr('');
    try { const [src] = await upload([f]); set({ alt: v?.alt ?? '', ...v, src }); }
    catch (x) { setErr(uploadError(x)); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
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
          <input ref={ref} type="file" accept="image/*,video/*" hidden onChange={pick} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : v?.src ? 'Replace' : 'Upload'}</button>
            {v?.src && <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => set(undefined)}>Remove</button>}
          </div>
          {err && <p style={{ color: 'var(--a-danger, #c4046f)', fontSize: 12, margin: '0 0 8px' }}>{err}</p>}
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

function QuickUpload({ label: text, accept, upload, onDone }: { label: string; accept: string; upload: Uploader; onDone: (srcs: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true); setErr('');
    try { onDone(await upload(files)); }
    catch (x) { setErr(uploadError(x)); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <span>
      <input ref={ref} type="file" accept={accept} multiple hidden onChange={pick} />
      <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : text}</button>
      {err && <span style={{ color: 'var(--a-danger, #c4046f)', fontSize: 12, marginLeft: 8 }}>{err}</span>}
    </span>
  );
}

function ImageList({ v, set, upload, phone, caption, add = 'Add images' }: {
  v?: Img[]; set: (v: Img[]) => void; upload: Uploader; phone?: boolean; caption?: boolean; add?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const list = v ?? [];
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const srcs = await upload(files);
      set([...list, ...srcs.map((src) => ({ src, alt: '' }))]);
    } catch (x) { setErr(uploadError(x)); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
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
      </div>
      <input ref={ref} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
      <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : `+ ${add}`}</button>
      {err && <p style={{ color: 'var(--a-danger, #c4046f)', fontSize: 12, margin: '6px 0 0' }}>{err}</p>}
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

function SplitEditor({ sp, set, startLabel, endLabel }: { sp: Split; set: (v: Split) => void; startLabel: string; endLabel: string }) {
  const pctMode = sp.unit === '%';
  const side = (k: 'start' | 'end', field: keyof Side, v: string) => {
    const next = { ...sp[k], [field]: v };
    // In percent mode the other side fills itself in (they add up to 100).
    if (pctMode && v.trim() !== '' && Number.isFinite(Number(v))) {
      const other = field === 'followers' ? 'nonFollowers' : 'followers';
      next[other] = String(Math.max(0, Math.round((100 - Number(v)) * 10) / 10));
    }
    set({ ...sp, [k]: next });
  };
  const cell = (k: 'start' | 'end', field: keyof Side, ph: string) => (
    <input style={input} value={String(sp[k][field])} placeholder={ph} inputMode="decimal" onChange={(e) => side(k, field, e.target.value)}
      aria-label={`${k === 'start' ? startLabel : endLabel}: ${field === 'followers' ? 'followers' : 'non-followers'}`} />
  );
  return (
    <div>
      <div style={{ ...grid(160), marginBottom: 6 }}>
        <input style={input} value={sp.label} placeholder="Interactions" list="growth-splits" onChange={(e) => set({ ...sp, label: e.target.value })} aria-label="What was split" />
        <select style={input} value={sp.unit ?? ''} onChange={(e) => set({ ...sp, unit: e.target.value === '%' ? '%' : undefined })} aria-label="Values are">
          <option value="%">Percentages (from Insights)</option><option value="">Counts</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1.2fr) 1fr 1fr', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
        <span /><span style={label}>Followers</span><span style={label}>Non-followers</span>
        <span>{startLabel}</span>{cell('start', 'followers', pctMode ? '70' : '1,200')}{cell('start', 'nonFollowers', pctMode ? '30' : '500')}
        <span>{endLabel}</span>{cell('end', 'followers', pctMode ? '45' : '2,100')}{cell('end', 'nonFollowers', pctMode ? '55' : '2,600')}
      </div>
    </div>
  );
}

function AccountEditor({ a, set }: { a: Account; set: (v: Account) => void }) {
  const startLabel = a.startLabel || 'Start of contract';
  const endLabel = a.endLabel || 'End of contract';
  const have = new Set(a.stats.map((x) => x.label.trim().toLowerCase()));
  const missing = USUAL_STATS.filter((x) => !have.has(x.label.toLowerCase()));
  return (
    <div>
      <div style={grid(150)}>
        <Txt l="Platform" v={a.platform} set={(platform) => set({ ...a, platform })} list="growth-platforms" />
        <Txt l="Handle" v={a.handle} set={(handle) => set({ ...a, handle })} ph="@client" />
        <Txt l="Contract dates" v={a.period} set={(period) => set({ ...a, period })} ph="Jan – Jun 2026" />
      </div>
      <div style={grid(150)}>
        <Txt l="Start is called" v={a.startLabel} set={(v) => set({ ...a, startLabel: v })} ph="Start of contract" />
        <Txt l="End is called" v={a.endLabel} set={(v) => set({ ...a, endLabel: v })} ph="End of contract" />
      </div>

      <span style={label}>Numbers — {startLabel} → {endLabel}</span>
      <p style={{ fontSize: 12, color: 'var(--a-muted)', margin: '0 0 8px' }}>
        From Insights for the same length of time at each end (e.g. the 30 days before you started vs the last 30 days). Rows left blank don’t show.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 2fr) 1fr 1fr 70px 150px', gap: 6, fontSize: 11.5, color: 'var(--a-faint)', marginRight: 112 }}>
        <span>Stat</span><span>{startLabel}</span><span>{endLabel}</span><span>Unit</span><span>Big number shows</span>
      </div>
      <Rows inline items={a.stats} set={(stats) => set({ ...a, stats })} add="Number" blank={() => ({ label: '', start: '', end: '' })}
        render={(st, up) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 2fr) 1fr 1fr 70px 150px', gap: 6 }}>
            <input style={input} value={st.label} placeholder="Followers" list="growth-stats" onChange={(e) => up({ ...st, label: e.target.value })} aria-label="Stat" />
            <input style={input} value={String(st.start)} placeholder="Start" inputMode="decimal" onChange={(e) => up({ ...st, start: e.target.value })} aria-label={startLabel} />
            <input style={input} value={String(st.end)} placeholder="End" inputMode="decimal" onChange={(e) => up({ ...st, end: e.target.value })} aria-label={endLabel} />
            <select style={input} value={st.unit ?? ''} onChange={(e) => up({ ...st, unit: e.target.value || undefined })} aria-label="Unit">
              <option value="">#</option><option value="%">%</option><option value="$">$</option>
            </select>
            <select style={input} value={st.lead ?? ''} onChange={(e) => up({ ...st, lead: (e.target.value || undefined) as Stat['lead'] })} aria-label="Big number shows">
              <option value="">Auto</option><option value="percent">% change</option><option value="gain">Amount gained</option><option value="end">End value</option>
            </select>
          </div>
        )} />
      {missing.length > 0 && (
        <button type="button" className={`${ui.btn} ${ui.btnSmall}`} style={{ marginTop: 6 }}
          onClick={() => set({ ...a, stats: [...a.stats, ...missing.map((x) => ({ ...x }))] })}>
          + Add the usual Insights stats ({missing.map((x) => x.label).join(', ')})
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <span style={label}>Followers vs non-followers</span>
        <p style={{ fontSize: 12, color: 'var(--a-muted)', margin: '0 0 8px' }}>
          Insights shows this under Views and Interactions. A bigger non-follower share at the end means the content is reaching new people.
        </p>
        <Rows items={a.splits} set={(splits) => set({ ...a, splits })} add="Comparison" blank={() => blankSplit('')}
          render={(sp, up) => <SplitEditor sp={sp} set={up} startLabel={startLabel} endLabel={endLabel} />} />
      </div>

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
  const [openSet, setOpenSet] = useState<Set<SectionId>>(new Set(['header']));
  const toggle = (id: SectionId) => setOpenSet((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /** From a Detail check pill: open that section and bring it into view. */
  const goTo = (id: SectionId) => {
    setOpenSet((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById(`cs-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

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

  /** Add uploads to the first group with this layout, or start one. */
  function addTo(layout: string, title: string, srcs: string[]) {
    setDraft((cur) => {
      const list = [...(cur?.showcase ?? [])];
      const i = list.findIndex((b) => (b.layout ?? 'grid') === layout);
      const imgs = srcs.map((src) => ({ src, alt: '' }));
      if (i >= 0) list[i] = { ...list[i], images: [...list[i].images, ...imgs] };
      else list.push({ title, text: '', layout, images: imgs });
      return { ...(cur ?? {}), showcase: list };
    });
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
          {([['web', 'Web design & development'], ['social', 'Social media'], ['other', 'Other (branding, UX, photos)']] as [Kind, string][]).map(([k, l]) => (
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
  // Which sections each kind shows. Another kind's section still shows if it already has content, so nothing on the page becomes uneditable.
  const SHOWN: Record<Kind, SectionId[]> = {
    web: ['header', 'hero', 'project', 'challenge', 'approach', 'pages', 'work', 'features', 'design', 'mobile', 'timeline', 'outcome'],
    social: ['header', 'hero', 'project', 'challenge', 'approach', 'growth', 'work', 'outcome'],
    other: ['header', 'hero', 'project', 'challenge', 'approach', 'work', 'features', 'design', 'timeline', 'outcome'],
  };
  const hasContent: Partial<Record<SectionId, boolean>> = {
    pages: (d.pages ?? []).some((pg) => filled(pg.title) && (pg.desktop?.src || filled(pg.text))),
    growth: (d.growth?.accounts ?? []).some((a) => a.stats.some((st) => ok(st.start) || ok(st.end)) || (a.series ?? []).some((se) => se.points.length) || (a.splits ?? []).some((sp) => ok(sp.start.followers))) || (d.growth?.screenshots ?? []).length > 0,
    features: (d.features ?? []).some((f) => filled(f.title)),
    design: filled(d.design?.intro) || (d.design?.colors ?? []).some((c) => filled(c.name)),
    mobile: (d.mobile?.shots ?? []).length > 0,
    timeline: (d.timeline ?? []).some((t) => filled(t.title) && filled(t.when)),
  };
  const show = (id: SectionId) => SHOWN[kind].includes(id) || !!hasContent[id];
  const isDone = (l: string) => list.find((c) => c.label === l)?.done;

  return (
    <OpenCtx.Provider value={{ open: openSet, toggle }}>
    <div key={version}>
      <datalist id="growth-stats">{STAT_NAMES.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="growth-splits">{SPLIT_NAMES.map((x) => <option key={x} value={x} />)}</datalist>
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
          <button key={k} type="button" className={`${ui.btn} ${ui.btnSmall} ${kind === k ? ui.btnPrimary : ''}`} onClick={() => { if (k === kind) return; setKind(k); setDraft((cur) => (cur ? switchTemplate(cur, k, title) : cur)); setDirty(true); setVersion((v) => v + 1); }}>
            {k === 'web' ? 'Web design & development' : k === 'social' ? 'Social media' : 'Other'}
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
          {kind === 'web' ? 'What The Burrell Group’s page has. Tap one to go to it.' : kind === 'social' ? 'A full social case study: the posts, the growth and the proof. Tap one to go to it.' : 'The basics every case study has. Tap one to go to it.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {list.map((c) => (
            <button key={c.label} type="button" className={w.pill} onClick={() => goTo(c.section)} title={`Go to ${c.label}`}
              style={{ cursor: 'pointer', border: 0, font: 'inherit', ...(c.done ? { background: '#0cf574', color: '#141414' } : { background: '#fff', color: 'var(--a-text)', boxShadow: 'inset 0 0 0 1.5px var(--a-border-strong)' }) }}>
              {c.done ? '✓ ' : ''}{c.label}
            </button>
          ))}
        </div>
      </div>

      <Section id="header" title="Header" done={isDone('Headline and intro')} hint="The project name, a one-line headline and the intro paragraph at the top of the page.">
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

      <Section id="hero" title="Main image" done={!!d.heroImage?.src} hint="The big image under the overview — a mockup of the work works best.">
        <ImagePick v={d.heroImage} set={(v) => up('heroImage', v)} upload={upload} />
      </Section>

      <Section id="project" title="The project" done={isDone('About the client') && isDone('3+ numbers')} hint="Who the client is, and the big numbers beside it. Only real, countable numbers.">
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

      <Section id="challenge" title="The challenge" done={isDone('Challenge with 3+ goals')}>
        <Area l="Intro" v={d.challenge?.intro} set={(v) => up('challenge', { ...(d.challenge ?? { intro: '' }), intro: v })} rows={3} />
        <span style={label}>Goals</span>
        <Rows items={d.challenge?.goals} set={(v) => up('challenge', { intro: d.challenge?.intro ?? '', goals: v })} add="Goal" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Goal" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
      </Section>

      <Section id="approach" title="The approach" done={(d.approach?.steps ?? []).some((s) => filled(s.title))} hint={kind === 'web' ? 'Optional for websites — the pages and features usually tell this.' : 'The steps, in order.'}>
        <Area l="Intro (optional)" v={d.approach?.intro} set={(v) => up('approach', { steps: d.approach?.steps ?? [], intro: v })} rows={2} />
        <Rows items={d.approach?.steps} set={(v) => up('approach', { intro: d.approach?.intro, steps: v })} add="Step" blank={() => ({ title: '', text: '' })}
          render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Step" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
      </Section>

      {show('pages') && (
        <Section id="pages" title="The pages" done={isDone('4+ pages with desktop shots') && isDone('Every page has a phone shot')} hint="Each page of the site: what it does, a desktop screenshot (shown in a browser frame) and a phone screenshot (shown in a phone frame beside it).">
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

      {show('growth') && (
        <Section id="growth" title="The growth" done={isDone('Growth numbers (start → end)') && isDone('Followers vs non-followers') && isDone('A growth chart (3+ points)') && isDone('2+ analytics screenshots')}
          hint="Each account's numbers from the start of the contract to the end (shown with the change, % and before/after bars), followers vs non-followers, charts over time, and analytics screenshots in phone frames. Use the real numbers from Insights.">
          <Area l="Intro (optional)" v={d.growth?.intro} rows={2} set={(v) => up('growth', { accounts: [], ...d.growth, intro: v })} />
          <Rows items={d.growth?.accounts} set={(v) => up('growth', { ...d.growth, accounts: v })} add="Account"
            blank={() => ({ platform: 'Instagram', stats: USUAL_STATS.map((x) => ({ ...x })), splits: [blankSplit('Interactions'), blankSplit('Views')], series: [] })}
            render={(a, u) => <AccountEditor a={a} set={u} />} />
          <div style={{ marginTop: 16 }}>
            <span style={label}>Analytics screenshots (shown in phone frames)</span>
            <Area v={d.growth?.screenshotsText} rows={2} ph="A line above the screenshots (optional)" set={(v) => up('growth', { accounts: [], ...d.growth, screenshotsText: v })} />
            <ImageList v={d.growth?.screenshots} phone caption add="Upload screenshots" upload={upload}
              set={(v) => up('growth', { accounts: [], ...d.growth, screenshots: v })} />
          </div>
        </Section>
      )}

      <Section id="work" title="The work" done={(d.showcase ?? []).some((b) => b.images.length)}
        hint={kind === 'social'
          ? 'Posts show in a grid; reels (and stories) play in phone frames, muted, while they’re on screen. MP4 videos play in every browser. Add a caption like “18K views” under a reel if you like.'
          : 'Groups of images. Layouts: grid, wide (one per row), posts (a grid of social posts), phones (phone frames — reels, stories, app screens).'}>
        {kind === 'social' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <QuickUpload label="+ Upload posts" accept="image/*,video/*" upload={upload} onDone={(srcs) => addTo('posts', 'Posts', srcs)} />
            <QuickUpload label="+ Upload reels" accept="video/*,image/*" upload={upload} onDone={(srcs) => addTo('phones', 'Reels', srcs)} />
          </div>
        )}
        <Rows items={d.showcase} set={(v) => up('showcase', v)} add="Group" blank={() => ({ title: '', text: '', layout: kind === 'social' ? 'posts' : 'grid', images: [] })}
          render={(b, u) => (
            <>
              <div style={grid(180)}>
                <Txt v={b.title} set={(t) => u({ ...b, title: t })} ph="Title (optional)" />
                <select style={{ ...input, marginBottom: 10 }} value={b.layout ?? 'grid'} onChange={(e) => u({ ...b, layout: e.target.value })} aria-label="Layout">
                  <option value="posts">Posts (grid)</option><option value="phones">Reels &amp; stories (phone frames)</option><option value="grid">Grid</option><option value="wide">Wide</option>
                </select>
              </div>
              <Area v={b.text} set={(t) => u({ ...b, text: t })} rows={2} ph="A line about this group (optional)" />
              <ImageList v={b.images} set={(x) => u({ ...b, images: x })} upload={upload} phone={b.layout === 'phones'} caption
                add={b.layout === 'phones' ? 'Upload reels' : b.layout === 'posts' ? 'Upload posts' : 'Add images'} />
            </>
          )} />
      </Section>

      {show('features') && (
        <Section id="features" title="Features" done={(d.features ?? []).filter((f) => filled(f.title)).length >= (kind === 'web' ? 4 : 1)}>
          <Rows items={d.features} set={(v) => up('features', v)} add="Feature" blank={() => ({ title: '', text: '' })}
            render={(g, u) => <><Txt v={g.title} set={(t) => u({ ...g, title: t })} ph="Feature" /><Area v={g.text} set={(t) => u({ ...g, text: t })} rows={2} /></>} />
        </Section>
      )}

      {show('design') && (
        <Section id="design" title="Design system" done={isDone('Design system (colours + notes)')}>
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
      )}

      {show('mobile') && (
        <Section id="mobile" title="On phones" done={isDone('3+ phone views')} hint="Phone screenshots, shown in phone frames.">
          <Area l="Intro" v={d.mobile?.intro} rows={2} set={(v) => up('mobile', { shots: d.mobile?.shots ?? [], intro: v })} />
          <ImageList v={d.mobile?.shots} phone upload={upload} add="Upload phone screenshots" set={(v) => up('mobile', { intro: d.mobile?.intro ?? '', shots: v })} />
        </Section>
      )}

      {show('timeline') && (
        <Section id="timeline" title="Timeline" done={(d.timeline ?? []).filter((t) => filled(t.title)).length >= 3}>
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
      )}

      <Section id="outcome" title="The outcome" done={isDone('Outcome')} hint="Leave the quote empty until the client has given one.">
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
    </OpenCtx.Provider>
  );
}
