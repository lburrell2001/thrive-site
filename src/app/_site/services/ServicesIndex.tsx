'use client';

// The Services overview (Nov 2026 redesign): the promise, a jump button per
// service, one brand-colour panel per service (real work, starting price,
// packages), how projects start, why Thrive, and the closing band. Copy is
// the page's existing wording; descriptions from serviceShowcase.ts, prices
// from servicePricing.ts.

import Link from 'next/link';
import { SHOWCASE } from '@/lib/serviceShowcase';
import { SERVICE_PRICING } from '@/lib/servicePricing';
import { storageUrl } from '@/lib/storage';
import CtaBand from '../CtaBand';
import { rd } from '../links';
import { ThriveIcon } from '../ThriveIcons';
import { useReveal } from '../useReveal';
import { SERVICE_CONFIGS } from './configs';
import s from '../redesign.module.css';
import x from './services-index.module.css';

const WHY = [
  { title: 'Color with a reason', text: 'Bold, culturally rooted design that looks like you. Never a template, never beige.', tone: s.bMagenta },
  { title: 'We design and build', text: 'The team that designs your brand builds your site and runs your social, so it all fits together.', tone: s.bOrange },
  { title: 'Founder to founder', text: 'We work with founder-led brands that still have a real person behind them. That’s who we built this for.', tone: s.bMint },
];

// Each jump button in its service's colour (set inline: the shared pill style is black).
const TONE_STYLE: Record<string, React.CSSProperties> = {
  bMagenta: { background: '#e50586', color: '#fff' },
  bBlue: { background: '#3943b7', color: '#fff' },
  bMint: { background: '#0cf574', color: '#141414' },
  bOrange: { background: '#fd6100', color: '#141414' },
  bPurple: { background: '#9409ce', color: '#fff' },
};

/** The first price list on each service page, its add-ons and any care plans: "Starter $1,250", "+ Analytics reporting …" */
function packagesFor(slug: keyof typeof SERVICE_PRICING) {
  const [first, ...rest] = SERVICE_PRICING[slug].sections;
  const care = rest.find((sec) => sec.id === 'care')?.cards[0];
  return [
    ...(first?.cards ?? []).slice(0, 4),
    ...(first?.addOns ?? []).map((a) => ({ ...a, name: `+ ${a.name.replace(/^Add-on:\s*/, '')}` })),
    ...(care ? [{ name: '+ Care plans after launch', price: `from ${care.price}` }] : []),
  ];
}

export default function ServicesIndex() {
  const root = useReveal<HTMLDivElement>();
  return (
    <div ref={root}>
      <section className={x.hero}>
        <h1 className={`${s.display} ${x.title}`}>Everything your brand needs. <span className={x.accent}>None of it beige.</span></h1>
        <p className={`${s.leadText} ${x.lede}`}>We do everything it takes to make your brand look as good as the work behind it — all under one roof. In person across DFW, remote across the US.</p>
        <nav className={x.jumps} aria-label="Jump to a service">
          {SHOWCASE.map((svc) => {
            const cfg = SERVICE_CONFIGS[svc.slug];
            return (
              <a key={svc.slug} href={`#${svc.slug}`} className={`${s.pill} ${x.jump}`} style={TONE_STYLE[cfg.tone]}>
                <ThriveIcon name={cfg.icon} className={x.jumpIcon} /> {cfg.title}
              </a>
            );
          })}
        </nav>
      </section>

      <div className={x.panels}>
        {SHOWCASE.map((svc, i) => {
          const cfg = SERVICE_CONFIGS[svc.slug];
          const pricing = SERVICE_PRICING[svc.slug];
          return (
            <section key={svc.slug} id={svc.slug} className={`${x.panel} ${s[cfg.tone]} ${i % 2 ? x.flip : ''} ${s.rise}`}>
              <Link href={rd(svc.href)} className={x.media} tabIndex={-1} aria-hidden>
                {svc.media.type === 'video' ? (
                  <video autoPlay muted loop playsInline preload="metadata" poster={svc.media.poster}>
                    <source src={storageUrl(`videos/${svc.media.src}`)} type="video/mp4" />
                  </video>
                ) : (
                  <img src={svc.media.local ? svc.media.src : storageUrl(svc.media.src)} alt="" loading="lazy" />
                )}
              </Link>
              <div className={x.body}>
                <div className={x.bodyTop}>
                  <span className={x.icon}><ThriveIcon name={cfg.icon} /></span>
                  <span className={x.from}>{pricing.from}</span>
                </div>
                <h2 className={`${s.display} ${x.name}`}>{cfg.title}</h2>
                <p className={x.desc}>{svc.desc}</p>
                <ul className={x.packages}>
                  {packagesFor(svc.slug).map((c) => (
                    <li key={c.name}><span>{c.name}</span><strong>{c.price}</strong></li>
                  ))}
                </ul>
                <Link href={rd(svc.href)} className={`${s.pill} ${s.pillBig} ${x.more}`}>Packages &amp; details</Link>
              </div>
            </section>
          );
        })}
      </div>

      <section className={x.block}>
        <div className={x.how}>
          <h2 className={`${s.display} ${x.sectionTitle} ${s.rise}`}>How we work</h2>
          <p className={`${s.leadText} ${x.howText}`}>Every project starts with a written proposal — scope, timeline and price up front. Nothing starts until you’ve agreed to it.</p>
        </div>
      </section>

      <section className={x.block}>
        <h2 className={`${s.display} ${x.sectionTitle} ${s.rise}`}>Why Thrive?</h2>
        <div className={x.why}>
          {WHY.map((w, i) => (
            <article key={w.title} className={`${x.whyCard} ${w.tone} ${s.rise}`} style={{ '--d': `${i * 80}ms` } as React.CSSProperties}>
              <h3 className={x.whyTitle}>{w.title}</h3>
              <p>{w.text}</p>
            </article>
          ))}
        </div>
      </section>

      <div className={x.spacer} />
      <CtaBand />
    </div>
  );
}
