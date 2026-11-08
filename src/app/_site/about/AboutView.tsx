'use client';

// The About page (Nov 2026 redesign): the mission, four facts, the founder,
// real work and the values. All copy is the page's existing wording.

import Link from 'next/link';
import type { WorkPhoto } from '@/lib/workPhotos';
import CtaBand from '../CtaBand';
import { rd } from '../links';
import { ThriveIcon, type ThriveIconName } from '../ThriveIcons';
import { useReveal } from '../useReveal';
import s from '../redesign.module.css';
import a from './about.module.css';

const STATS = [
  { num: '100%', label: 'Black-Owned & Led', tone: s.bMagenta },
  { num: '5+', label: 'Core Services', tone: s.bOrange },
  { num: 'Open', label: 'Taking Clients', tone: s.bMint },
  { num: 'Dallas', label: 'Based in TX', tone: s.bBlue },
];

const VALUES: { title: string; desc: string; icon: ThriveIconName; tone: string }[] = [
  { title: 'Representation', icon: 'person', tone: s.bMagenta, desc: 'We build for the underrepresented. Every project is a step toward an industry that finally looks as rich and diverse as the world we live in.' },
  { title: 'Boldness', icon: 'sparkle', tone: s.bOrange, desc: 'We don’t do safe. We do strategic, intentional, and unforgettable — work that makes people stop mid-scroll and actually pay attention.' },
  { title: 'Excellence', icon: 'pen', tone: s.bMint, desc: 'Good enough is never enough. We obsess over every detail — because your brand deserves nothing less than extraordinary.' },
  { title: 'Community', icon: 'social', tone: s.bPurple, desc: 'We’re not just building brands — we’re building with community. Everything we create is rooted in real connection and collective growth.' },
];


export default function AboutView({ titles, photos }: { titles: Record<string, string>; photos: WorkPhoto[] }) {
  const root = useReveal<HTMLDivElement>();
  return (
    <div ref={root}>
      {/* ── Mission ── */}
      <section className={a.hero}>
        <h1 className={`${s.display} ${a.title}`}>Built for the ones who were missing from the room.</h1>
        <p className={`${a.mission} ${s.bBlack}`}>
          Thrive exists because Black creatives — especially Black women — have always been forces in the creative
          world, but not always given the seat, the stage, or the spotlight they deserve. So we built the room
          ourselves. Every brand we touch is a deliberate step toward an industry that finally looks as rich and
          diverse as the world we live in.
        </p>
      </section>

      {/* ── Four facts ── */}
      <div className={a.stats}>
        {STATS.map((st, i) => (
          <div key={st.label} className={`${a.stat} ${st.tone} ${s.rise}`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
            <span className={a.statNum}>{st.num}</span>
            <span className={a.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* ── Founder ── */}
      <section className={a.founder}>
        <div className={`${a.portrait} ${s.rise}`}>
          <img src="/lauren-portrait.jpg" alt="Lauren Burrell, founder of Thrive Creative Studios" />
          <span className={a.sticker} aria-hidden><img src="/new-thrive/logo-mark.svg" alt="" /></span>
        </div>
        <div className={a.founderText}>
          <h2 className={`${s.display} ${a.name}`}>Lauren Burrell</h2>
          <p className={a.role}>Founder &amp; Creative Director</p>
          <p className={a.bio}>
            I started Thrive because I looked around the creative industry and didn’t see enough people who looked like
            me leading the rooms that matter. So I built one. Thrive is my proof — to every Black creative, every
            underrepresented founder, every brand that’s been told to play it safe — that bold, strategic, culturally
            rich work isn’t the exception. It’s the standard.
          </p>
          <Link href={rd('/portfolio')} className={`${s.pill} ${s.pillBig}`}>See the work</Link>
        </div>
      </section>

      {/* ── Real work ── */}
      <section className={a.block}>
        <h2 className={`${s.display} ${a.sectionTitle} ${s.rise}`}>Bold by design</h2>
        <div className={a.strip}>
          {photos.map((p, i) => (
            <Link key={p.href} href={rd(p.href)} className={`${a.stripPhoto} ${s.rise}`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
              <img src={p.src} alt={p.alt} loading="lazy" style={p.position ? { objectPosition: p.position } : undefined} />
              <span className={a.tag}>{titles[p.href] ?? p.caption}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className={a.block}>
        <h2 className={`${s.display} ${a.sectionTitle} ${s.rise}`}>Our values</h2>
        <div className={a.values}>
          {VALUES.map((v, i) => (
            <article key={v.title} className={`${a.value} ${v.tone} ${s.rise}`} style={{ '--d': `${i * 80}ms` } as React.CSSProperties}>
              <ThriveIcon name={v.icon} className={a.valueIcon} />
              <h3 className={a.valueTitle}>{v.title}</h3>
              <p>{v.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <div className={a.spacer} />
      <CtaBand />
    </div>
  );
}
