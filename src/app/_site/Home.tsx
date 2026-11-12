'use client';

// The new front end, staged at /redesign (Nov 2026). The layout language
// follows the TURNSTUDIO reference — pill buttons, a giant wordmark, floating
// cursor tags, a round sticker, tilted pastel cards, a process row, a dark
// numbers card, quote cards and a full-screen menu of coloured panels — in
// Thrive's logo, Poppins Bold for headings (−80 large, −65 small) and
// Poppins Medium at −55 for everything else. Everything on it is real: photos are client work, quotes are
// the ones already on the site, and the numbers are counted from the
// portfolio.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { projectCoverThumb } from '@/lib/storage';
import type { ReelProject } from '@/lib/workReel';
import type { HomePhotos } from '@/lib/homeCollage';
import { rectVars, type Layout } from '@/lib/collageLayout';
import { ThriveIcon } from './ThriveIcons';
import { rd } from './links';
import CtaBand from './CtaBand';
import s from './redesign.module.css';

// ---------------------------------------------------------------- content

// Cursor tags drifting over the hero: what Thrive does, in Thrive's colours.
const CURSORS = [
  { label: 'Branding', tone: s.cOrange, spot: s.cur1 },
  { label: 'Web', tone: s.cMint, spot: s.cur2 },
  { label: 'Social', tone: s.cMagenta, spot: s.cur3 },
  { label: 'Photo', tone: s.cBlue, spot: s.cur4 },
];

// Only what the service pages already promise. Colours follow each service's colour elsewhere on the site.
const SERVICES = [
  { title: 'Brand & Graphic Design', href: '/services/brand-design', tone: s.bBlue, icon: 'brand' as const,
    items: ['Logos & full identities', 'Posters & event flyers', 'Social graphics', 'Menus, brochures & signage', 'Packaging & merch'] },
  { title: 'Web Design & Development', href: '/services/digital-design', tone: s.bMagenta, icon: 'web' as const,
    items: ['Custom-coded sites', 'WordPress, Wix & Squarespace', 'App & website prototypes', 'Your colors, never a template', 'Care plans after launch'] },
  { title: 'Social Media', href: '/services/social-media', tone: s.bMint, icon: 'social' as const,
    items: ['Monthly content calendar', 'Designed graphics', 'Edited videos', 'Captions & hashtags', 'Scheduling & posting'] },
  { title: 'Photography', href: '/services/photography', tone: s.bPurple, icon: 'photo' as const,
    items: ['Your people', 'Your product', 'Your space', 'A shot list for every session'] },
];

// Each step in one of Thrive's colours, with a petal from the logo turned a quarter further each time.
const STEPS = [
  { title: 'Listen', sub: 'Discovery & story', tone: s.stepMagenta, turn: -50,
    text: 'Deep dives into your brand, your audience, your goals — and the story only you can tell.' },
  { title: 'Strategize', sub: 'Scope & proposal', tone: s.stepOrange, turn: -10,
    text: 'You get a written proposal with the scope, timeline and price before any work begins.' },
  { title: 'Create', sub: 'Design & build', tone: s.stepBlue, turn: 30,
    text: 'Bold concepts, refined execution, and relentless attention to every detail.' },
  { title: 'Launch & grow', sub: 'Launch & partner', tone: s.stepMint, turn: 70,
    text: 'Launch-ready deliverables — and ongoing partnership to keep your brand growing long after handoff.' },
];

// The three quotes are chosen in admin (Website → Homepage → Quotes): client
// reviews or typed ones. These are the defaults, used until then.
const QUOTE_TONES = [s.bBlue, s.bMint, s.bMagenta];
const DEFAULT_QUOTES = [
  { text: 'Thrive completely transformed how our brand shows up. The energy, the vision, the execution — nothing short of exceptional.', who: 'DJ Mastamind' },
  { text: 'Working with Thrive felt like working with people who actually understood our community.', who: 'Classic Rollers' },
  { text: 'The work they did set us apart immediately. Bold, intentional, and exactly right.', who: 'The Burrell Group' },
];

// Every photo in the hero mosaic, the statement and the services heading is
// chosen in admin (Website → Homepage, src/lib/homeCollage.ts).

const STATEMENT = 'We design and build brands, websites and content that people remember — in your colors, with your story, never from a template.';

/** One petal of the Thrive flower (from the logo mark). */
function Petal({ turn }: { turn: number }) {
  return (
    <svg className={s.petal} viewBox="166 90 26 39" style={{ transform: `rotate(${turn}deg)` }} aria-hidden>
      <path d="M187.37,123.58c-1.25,2.95-1.92,4.13-5.13,4.13h-3.86c-3.21,0-3.83-1.27-5.15-4.19-4.09-9.09-5.84-17.08-5.42-27.26.13-3.2,1.41-4.62,4.62-4.62h14.47c3.21,0,4.47,1.41,4.62,4.62.47,9.86-.42,18.54-4.16,27.32Z" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------- page

export default function Redesign({ projects, photos }: { projects: ReelProject[]; photos: HomePhotos }) {
  const { collage, fan, inline } = photos;
  const rootRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLParagraphElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Scroll: the statement filling in word by word, the logo on the process bar.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      const st = statementRef.current;
      if (st) {
        const r = st.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        const words = st.querySelectorAll<HTMLElement>('[data-w]');
        const on = Math.round(p * words.length);
        words.forEach((w, i) => w.toggleAttribute('data-on', i < on));
      }
      // The logo mark rides the bar under the steps as they scroll through.
      // On phones the bar runs down the side of the stacked steps, so the mark
      // keeps level with the step being read (a little below mid-screen).
      const steps = stepsRef.current;
      const slider = sliderRef.current;
      if (steps && slider) {
        const r = steps.getBoundingClientRect();
        const side = window.matchMedia('(max-width: 720px)').matches;
        const p = side
          ? (vh * 0.6 - r.top) / r.height
          : (vh * 0.9 - r.top) / (r.height + vh * 0.4);
        slider.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(3));
      }
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Fade-ins.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add(s.in); obs.unobserve(e.target); }
    }), { threshold: 0.15 });
    root.querySelectorAll(`.${s.rise}`).forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const work = projects.slice(0, 6);
  const quotes = (photos.quotes?.length ? photos.quotes : DEFAULT_QUOTES).map((q, i) => ({ text: q.text, who: q.who, service: (q as { service?: string | null }).service ?? null, tone: QUOTE_TONES[i % QUOTE_TONES.length] }));
  // Tiles are labelled with the project's title (a photo's own caption can be the shot's name).
  const titleOf = (href: string) => projects.find((p) => href === `/work/${p.slug}`)?.title;

  return (
    <div ref={rootRef}>
        {/* ── Hero ── */}
        <section className={s.hero}>
          {/* Logo, tagline, sticker and cursors move as one block, so they stay together at any width. */}
          <div className={s.heroTop}>
            <h1 className={s.wordmark}>
              <img src="/new-thrive/logo.svg" alt="Thrive Creative Studios" />
            </h1>
            <p className={s.tagline}>We Bring the Color Back</p>
            <div className={s.sticker} aria-hidden>
              <span>Bold brands, built in Dallas, TX</span>
            </div>
            {CURSORS.map((c) => (
              <span key={c.label} className={`${s.cursor} ${c.spot}`} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" className={c.tone}><path d="M3 2l18 8-8 2.5L10 21z" fill="currentColor" /></svg>
                <span className={`${s.cursorTag} ${c.tone}`}>{c.label}</span>
              </span>
            ))}
          </div>
          {/* Desktop and phones each have their own mosaic, laid out in admin. */}
          {(['desktop', 'phone'] as Layout[]).map((layout) => (
            <div key={layout} className={`${s.collage} ${layout === 'phone' ? s.collagePhone : s.collageDesk}`}>
              {collage[layout].map((t, i) => (
                <Link key={`${i}-${t.src}`} href={rd(t.href)} className={s.tile} style={{ ...rectVars(t), '--d': `${i * 60}ms` } as React.CSSProperties}>
                  <img src={t.url} alt={t.alt} loading={layout === 'desktop' && i < 3 ? 'eager' : 'lazy'} decoding="async" />
                  <span className={s.tileTag}>{titleOf(t.href) ?? t.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </section>

        {/* ── Statement: client work fanned out, words filling in as you scroll ── */}
        <section className={s.statement}>
          <div className={`${s.fan} ${s.rise}`} aria-hidden>
            {fan.map((src, k) => <img key={k} src={src} alt="" className={s[`fan${k}`]} loading="lazy" />)}
          </div>
          <h2 className={`${s.leadHead} ${s.rise}`}>We’re a Dallas creative studio where color meets strategy.</h2>
          <p ref={statementRef} className={s.fill}>
            {STATEMENT.split(' ').map((w, i) => <span key={i} data-w>{w} </span>)}
          </p>
        </section>

        {/* ── Services: photos inside the heading, then the tilted cards ── */}
        <section className={s.services}>
          <h2 className={`${s.display} ${s.inlineHead} ${s.rise}`}>
            We’re a <img src={inline[0]} alt="" className={s.inlinePhoto} /> Full-Service<br />
            <img src={inline[1]} alt="" className={s.inlinePhoto} /> Creative Studio
          </h2>
          <div id="services" className={s.cards}>
            {SERVICES.map((svc, i) => (
              <Link key={svc.href} href={rd(svc.href)} className={`${s.card} ${svc.tone} ${s.rise}`} style={{ '--tilt': `${[-4, 3, -2, 4, -3][i]}deg`, '--d': `${i * 70}ms`, '--float': `${i * -1.3}s`, '--from': i % 2 ? '1' : '-1' } as React.CSSProperties}>
                <ThriveIcon name={svc.icon} className={s.cardIcon} />
                <h3 className={s.cardTitle}>{svc.title}</h3>
                <ul>{svc.items.map((it, j) => <li key={it} style={{ '--j': j } as React.CSSProperties}>{it}</li>)}</ul>
                <span className={s.cardGo} aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Process: four colour cards in a row, the whole panel no taller than the screen ── */}
        <section id="how-we-work" className={s.process}>
          <div className={s.processHead}>
            <h2 className={`${s.display} ${s.rise}`}>How We Work</h2>
            <p className={`${s.processLead} ${s.rise}`}>Four steps, one team, and you see the price before anything starts.</p>
          </div>
          <div className={s.stepsWrap}>
          <ol ref={stepsRef} className={s.steps}>
            {STEPS.map((st, i) => (
              <li key={st.title} className={`${s.step} ${st.tone} ${s.rise}`} style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
                <Petal turn={st.turn} />
                <span className={s.stepNo} aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={s.stepTitle}>{st.title}</h3>
                <p className={s.stepSub}>{st.sub}</p>
                <p className={s.stepText}>{st.text}</p>
              </li>
            ))}
          </ol>
          <div ref={sliderRef} className={s.slider} aria-hidden>
            <div className={s.sliderFill}>
              <img src="/new-thrive/logo-mark-blk.svg" alt="" className={s.sliderMark} />
            </div>
          </div>
          </div>
        </section>

        {/* ── Numbers: counted, not claimed ── */}
        <section className={s.numbersWrap}>
          <div className={`${s.numbers} ${s.rise}`}>
            <div className={s.figures}>
              <div><p className={s.figure}>{projects.length || '—'}</p><p className={s.figureLabel}>Projects in the portfolio</p></div>
              <div><p className={s.figure}>5</p><p className={s.figureLabel}>Services under one roof</p></div>
              <div><p className={s.figure}>1</p><p className={s.figureLabel}>Team that designs and builds</p></div>
            </div>
            <p className={s.numbersLine}>The people who design your brand are the people who build it — so your colors, voice and story carry from your business card to your homepage to your feed.</p>
          </div>
        </section>

        {/* ── Quotes ── */}
        <section className={s.quotes}>
          <h2 className={`${s.display} ${s.quotesHead} ${s.rise}`}>Beyond clients.<br />Trusted partners.</h2>
          <div className={s.quoteRow}>
            {quotes.map((q, i) => (
              <figure key={i} className={`${s.quote} ${q.tone} ${s.rise} ${q.text.length > 240 ? s.quoteLong : ''}`} style={{ '--d': `${i * 90}ms`, '--tilt': `${[-2, 2, -1][i]}deg` } as React.CSSProperties}>
                <span className={s.quoteMark} aria-hidden>”</span>
                <blockquote>{q.text}</blockquote>
                <figcaption>{q.who}{q.service ? <span className={s.quoteService}>{q.service}</span> : null}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Work ── */}
        <section className={s.work}>
          <div className={s.workHead}>
            <h2 className={`${s.display} ${s.rise}`}>Our Work</h2>
            <Link href={rd('/portfolio')} className={`${s.pill} ${s.pillDark}`}>See all work</Link>
          </div>
          <div className={s.workGrid}>
            {work.map((p, i) => (
              <Link key={p.slug} href={rd(`/work/${p.slug}`)} className={`${s.workCard} ${s.rise}`} style={{ '--d': `${(i % 3) * 80}ms` } as React.CSSProperties}>
                <div className={s.workImg}><img src={projectCoverThumb(p.slug, 900)} alt={`${p.title} cover`} loading="lazy" decoding="async" /></div>
                <p className={s.workTitle}>{p.title}</p>
                {p.category && <p className={s.workCat}>{p.category}</p>}
              </Link>
            ))}
          </div>
        </section>

        <CtaBand />
    </div>
  );
}
