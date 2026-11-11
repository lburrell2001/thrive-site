// Cleaning a case study (pure — the admin editor and the save route use it too):
// trims empty rows and sections so the page only shows what's really filled in.

import type { CaseImage, CaseStudy, CaseGrowth } from '@/app/work/caseStudies';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,\s$%]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

function image(v: unknown): CaseImage | undefined {
  const o = obj(v);
  const src = str(o.src);
  if (!src) return undefined;
  const caption = str(o.caption);
  return { src, alt: str(o.alt), ...(caption ? { caption } : {}) };
}
const images = (v: unknown) => arr(v).map(image).filter((x): x is CaseImage => !!x);
const texts = (v: unknown) => arr(v).map(str).filter(Boolean);
function titled(v: unknown) {
  return arr(v).map((x) => ({ title: str(obj(x).title), text: str(obj(x).text) })).filter((x) => x.title || x.text);
}

function growth(v: unknown): CaseGrowth | undefined {
  const g = obj(v);
  const accounts = arr(g.accounts).map((a) => {
    const o = obj(a);
    const stats = arr(o.stats).map((s) => {
      const so = obj(s);
      const lead = ['percent', 'gain', 'end'].includes(str(so.lead)) ? str(so.lead) as 'percent' : undefined;
      return { label: str(so.label), start: num(so.start), end: num(so.end), unit: str(so.unit) || undefined, ...(lead ? { lead } : {}) };
    }).filter((s) => s.label && Number.isFinite(s.start) && Number.isFinite(s.end));
    const side = (v: unknown) => ({ followers: num(obj(v).followers), nonFollowers: num(obj(v).nonFollowers) });
    const okSide = (x: { followers: number; nonFollowers: number }) =>
      Number.isFinite(x.followers) && Number.isFinite(x.nonFollowers) && x.followers >= 0 && x.nonFollowers >= 0 && x.followers + x.nonFollowers > 0;
    const splits = arr(o.splits).map((sp) => {
      const so = obj(sp);
      return { label: str(so.label), start: side(so.start), end: side(so.end), ...(str(so.unit) === '%' ? { unit: '%' as const } : {}) };
    }).filter((sp) => sp.label && okSide(sp.start) && okSide(sp.end));
    const series = arr(o.series).map((s) => {
      const so = obj(s);
      const points = arr(so.points).map((p) => ({ when: str(obj(p).when), value: num(obj(p).value) }))
        .filter((p) => p.when && Number.isFinite(p.value));
      return { label: str(so.label), unit: str(so.unit) || undefined, points };
    }).filter((s) => s.label && s.points.length >= 2);
    return {
      platform: str(o.platform), handle: str(o.handle).replace(/^@/, '') || undefined, period: str(o.period) || undefined,
      stats, series: series.length ? series : undefined,
      splits: splits.length ? splits : undefined,
      startLabel: str(o.startLabel) || undefined, endLabel: str(o.endLabel) || undefined,
    };
  }).filter((a) => a.platform && (a.stats.length || a.series || a.splits));
  const screenshots = images(g.screenshots);
  if (!accounts.length && !screenshots.length) return undefined;
  return {
    intro: str(g.intro) || undefined,
    accounts,
    screenshots: screenshots.length ? screenshots : undefined,
    screenshotsText: str(g.screenshotsText) || undefined,
  };
}

/** Clean a stored or edited case study. Returns null when it has no header to show. */
export function normalizeCaseStudy(raw: unknown, slug: string): CaseStudy | null {
  const r = obj(raw);
  const client = str(r.client);
  const headline = str(r.headline);
  if (!client || !headline) return null;
  const seo = obj(r.seo);
  const ch = obj(r.challenge);
  const ap = obj(r.approach);
  const de = obj(r.design);
  const mo = obj(r.mobile);
  const q = obj(r.quote);
  const rel = obj(r.related);

  const cs: CaseStudy = {
    slug,
    client,
    headline,
    lede: str(r.lede),
    meta: arr(r.meta).map((m) => ({ label: str(obj(m).label), value: str(obj(m).value) })).filter((m) => m.label && m.value),
    about: texts(r.about),
    outcome: texts(r.outcome),
  };
  const liveUrl = str(r.liveUrl);
  if (/^https?:\/\//.test(liveUrl)) cs.liveUrl = liveUrl;
  if (str(seo.title) && str(seo.description)) cs.seo = { title: str(seo.title), description: str(seo.description) };
  cs.heroImage = image(r.heroImage);
  const numbers = arr(r.numbers).map((n) => ({ value: str(obj(n).value), label: str(obj(n).label) })).filter((n) => n.value && n.label);
  if (numbers.length) cs.numbers = numbers;
  if (str(ch.intro)) cs.challenge = { intro: str(ch.intro), ...(titled(ch.goals).length ? { goals: titled(ch.goals) } : {}) };
  if (titled(ap.steps).length) cs.approach = { ...(str(ap.intro) ? { intro: str(ap.intro) } : {}), steps: titled(ap.steps) };
  const pages = arr(r.pages).map((p) => {
    const o = obj(p);
    return { title: str(o.title), text: str(o.text), desktop: image(o.desktop), mobile: image(o.mobile) };
  }).filter((p): p is typeof p & { desktop: CaseImage } => !!p.title && !!p.desktop)
    .map((p) => (p.mobile ? p : { title: p.title, text: p.text, desktop: p.desktop }));
  if (pages.length) cs.pages = pages;
  const showcase = arr(r.showcase).map((b) => {
    const o = obj(b);
    const layout = ['grid', 'wide', 'phones', 'posts'].includes(str(o.layout)) ? str(o.layout) as 'grid' : undefined;
    return { title: str(o.title) || undefined, text: str(o.text) || undefined, images: images(o.images), layout };
  }).filter((b) => b.images.length);
  if (showcase.length) cs.showcase = showcase;
  if (titled(r.features).length) cs.features = titled(r.features);
  if (str(de.intro)) {
    const colors = arr(de.colors).map((c) => ({ name: str(obj(c).name), hex: str(obj(c).hex) }))
      .filter((c) => c.name && /^#[0-9a-f]{3,8}$/i.test(c.hex));
    const fullPages = images(de.fullPages);
    cs.design = {
      intro: str(de.intro),
      ...(colors.length ? { colors } : {}),
      ...(str(de.type) ? { type: str(de.type) } : {}),
      ...(titled(de.patterns).length ? { patterns: titled(de.patterns) } : {}),
      ...(fullPages.length ? { fullPages } : {}),
    };
  }
  const timeline = arr(r.timeline).map((t) => ({ when: str(obj(t).when), title: str(obj(t).title), text: str(obj(t).text) }))
    .filter((t) => t.when && t.title);
  if (timeline.length) cs.timeline = timeline;
  const shots = images(mo.shots);
  if (shots.length) cs.mobile = { intro: str(mo.intro), shots };
  cs.growth = growth(r.growth);
  if (str(q.text) && str(q.author)) cs.quote = { text: str(q.text), author: str(q.author) };
  if (str(rel.label) && str(rel.href)) {
    cs.related = { before: str(rel.before), label: str(rel.label), href: str(rel.href), ...(str(rel.after) ? { after: str(rel.after) } : {}) };
  }
  const stack = texts(r.stack);
  if (stack.length) cs.stack = stack;
  for (const k of Object.keys(cs) as (keyof CaseStudy)[]) if (cs[k] === undefined) delete cs[k];
  return cs;
}

