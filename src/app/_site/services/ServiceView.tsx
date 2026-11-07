'use client';

// A redesigned service page: giant title with the service's icon and starting
// price, the longer read and who it's for, what you get, the packages, the
// process, real work, client reviews, the FAQs and the closing band. All copy
// comes from the live page's sources (configs.ts, serviceSeo.ts,
// servicePricing.ts) so nothing here says more than the site already does.

import Link from 'next/link';
import type { ServicePricing } from '@/lib/servicePricing';
import type { WorkPhoto } from '@/lib/workPhotos';
import CtaBand from '../CtaBand';
import { rd } from '../links';
import { ThriveIcon } from '../ThriveIcons';
import { useReveal } from '../useReveal';
import type { ServiceConfig } from './configs';
import s from '../redesign.module.css';
import v from './service.module.css';

const TONES = [s.bMagenta, s.bOrange, s.bBlue, s.bMint, s.bPurple];

// The about heading is stored in capitals ("A WEBSITE THAT WORKS…"); headings here are title case.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'you', 'with']);
function titleCase(text: string) {
  return text.toLowerCase().split(' ').map((w, i) => (i > 0 && SMALL.has(w) && w !== 'you' ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

type Review = { id: string; name: string; role: string | null; body: string };

/**
 * A price with its small print set smaller, so every price fits on one line:
 * "From $325/month" → small "From", big "$325", small "/month". Text that
 * isn't a price ("Contact for pricing") is shown as is.
 */
function Price({ text }: { text: string }) {
  const m = text.match(/^(From\s+)?(\$[\d,]+(?:\.\d+)?\+?)(.*)$/i);
  if (!m) return <span className={v.priceWords}>{text}</span>;
  return (
    <>
      {m[1] && <small className={v.priceSmall}>{m[1].trim()} </small>}
      {m[2]}
      {m[3] && <small className={v.priceSmall}>{m[3]}</small>}
    </>
  );
}

export default function ServiceView({ config, about, faqs, pricing, photos, reviews }: {
  config: ServiceConfig;
  about: { heading: string; paragraphs: string[]; forWho: string[] } | null;
  faqs: { q: string; a: string }[];
  pricing: ServicePricing;
  photos: WorkPhoto[];
  reviews: Review[];
}) {
  const root = useReveal<HTMLDivElement>();
  const tone = s[config.tone];
  const [first, ...rest] = config.title.split(' ');

  return (
    <div ref={root}>
      {/* ── Hero ── */}
      <section className={v.hero}>
        <div className={v.heroText}>
          <span className={`${v.heroIcon} ${tone}`}><ThriveIcon name={config.icon} /></span>
          <h1 className={`${s.display} ${v.title}`}>{first}{rest.length > 0 && <><br />{rest.join(' ')}</>}</h1>
          <p className={`${s.leadText} ${v.lede}`}>{config.lede}</p>
          <div className={v.heroActions}>
            <Link href={rd('/contact')} className={`${s.pill} ${s.pillBig}`}>Let’s Start a Project</Link>
            <a href="#pricing" className={`${s.pill} ${s.pillBig} ${s.pillOutline}`}>See pricing</a>
          </div>
        </div>
        <a href="#pricing" className={`${v.price} ${tone}`} aria-label={`${pricing.from}, see pricing`}>{pricing.from}</a>
        <div className={v.heroPhotos}>
          {photos.slice(0, 2).map((p, i) => (
            <Link key={p.href} href={rd(p.href)} className={`${v.heroPhoto} ${s.rise}`} style={{ '--d': `${i * 100}ms` } as React.CSSProperties}>
              <img src={p.src} alt={p.alt} style={p.position ? { objectPosition: p.position } : undefined} />
              <span className={v.photoTag}>{p.caption}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── The longer read, and who it's for ── */}
      {about && (
        <section className={v.about}>
          <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>{titleCase(about.heading)}</h2>
          <div className={v.aboutGrid}>
            <div className={v.aboutText}>
              {about.paragraphs.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
              {config.related && (
                <p>{config.related.before}<Link href={config.related.href} className={v.inlineLink}>{config.related.label}</Link>{config.related.after}</p>
              )}
            </div>
            <aside className={`${v.forWho} ${tone} ${s.rise}`}>
              <h3 className={v.cardHead}>Who it’s for</h3>
              <ul>{about.forWho.map((f) => <li key={f}>{f}</li>)}</ul>
            </aside>
          </div>
        </section>
      )}

      {/* ── What you get: the heading and a real site on the left, a ruled list with icons on the right ── */}
      <section id="what-you-get" className={v.block}>
        <div className={v.getGrid}>
          <div className={v.getIntro}>
            <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>{config.deliverablesHeading}</h2>
            {photos[0] && (
              <Link href={rd(photos[0].href)} className={`${v.getPhoto} ${s.rise}`}>
                <img src={photos[0].src} alt={photos[0].alt} loading="lazy" />
                <span className={v.photoTag}>{photos[0].caption}</span>
              </Link>
            )}
          </div>
          <ul className={v.getList}>
            {config.deliverables.map((d, i) => (
              <li key={d.title} className={`${v.getRow} ${s.rise}`} style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
                <span className={`${v.getIcon} ${TONES[i % TONES.length]}`}><ThriveIcon name={d.icon} /></span>
                <h3 className={v.getTitle}>{d.title}</h3>
                <p className={v.getText}>{d.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className={v.block}>
        {pricing.sections.map((sec) => (
          <div key={sec.id} className={v.priceSection}>
            <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>{sec.heading}</h2>
            {sec.intro && <p className={`${s.leadText} ${v.intro}`}>{sec.intro}</p>}
            <div className={v.priceCards} style={{ '--n': Math.min(sec.cards.length, 4) } as React.CSSProperties}>
              {sec.cards.map((c, i) => (
                <article key={c.name} className={`${v.priceCard} ${s.rise}`} style={{ '--d': `${i * 80}ms` } as React.CSSProperties}>
                  <div className={`${v.priceTop} ${TONES[i % TONES.length]}`}>
                    <h3 className={v.cardHead}>{c.name}</h3>
                    <p className={v.priceValue}><Price text={c.price} /></p>
                    {c.scope && <p className={v.scope}>{c.scope}</p>}
                  </div>
                  {c.items && <ul className={v.items}>{c.items.map((it) => <li key={it}>{it}</li>)}</ul>}
                  <div className={v.priceActions}>
                    <Link href={rd(c.cta?.href ?? '/contact')} className={`${s.pill} ${v.priceBtn}`}>{c.cta?.label ?? 'Get started'}</Link>
                    {c.link && <Link href={rd(c.link.href)} className={v.inlineLink}>{c.link.label}</Link>}
                  </div>
                </article>
              ))}
            </div>
            {sec.includes && (
              <div className={v.includes}>
                <h3 className={v.cardHead}>{sec.includes.heading}</h3>
                <ul>{sec.includes.items.map((it) => <li key={it}>{it}</li>)}</ul>
              </div>
            )}
            {sec.addOns && sec.addOns.length > 0 && (
              <div className={v.addOns}>
                <h3 className={v.cardHead}>Add-ons</h3>
                <ul>
                  {sec.addOns.map((a) => (
                    <li key={a.name}><span>{a.name}{a.scope ? <span className={v.addScope}> · {a.scope}</span> : null}</span><strong>{a.price}</strong></li>
                  ))}
                </ul>
              </div>
            )}
            {sec.notes && sec.notes.map((n) => <p key={n} className={v.note}>{n}</p>)}
          </div>
        ))}
      </section>

      {/* ── Process: four colour stops on one line ── */}
      <section id="process" className={v.block}>
        <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>{config.processHeading}</h2>
        <ol className={v.stepper} style={{ '--n': config.process.length } as React.CSSProperties}>
          {config.process.map((p, i) => (
            <li key={p.title} className={`${v.stop} ${s.rise}`} style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
              <span className={`${v.dot} ${TONES[i % TONES.length]}`}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={v.stopTitle}>{p.title}</h3>
              <p className={v.stopText}>{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Real work ── */}
      {photos.length > 0 && (
        <section className={v.work}>
          <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>{config.workHeading}</h2>
          <div className={v.workGrid}>
            {photos.map((p, i) => (
              <Link key={p.href} href={rd(p.href)} className={`${v.workCard} ${s.rise}`} style={{ '--d': `${i * 80}ms` } as React.CSSProperties}>
                <span className={v.workImg}><img src={p.src} alt={p.alt} loading="lazy" style={p.position ? { objectPosition: p.position } : undefined} /></span>
                <span className={v.workName}>{p.caption}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Reviews (only once there are some) ── */}
      {reviews.length > 0 && (
        <section className={v.block}>
          <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>What clients say</h2>
          <div className={v.reviews}>
            {reviews.map((r, i) => (
              <figure key={r.id} className={`${v.review} ${TONES[i % TONES.length]} ${s.rise}`}>
                <blockquote>“{r.body}”</blockquote>
                <figcaption><strong>{r.name}</strong>{r.role ? ` · ${r.role}` : ''}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ── Good to know ── */}
      <section className={v.block}>
        <h2 className={`${s.display} ${v.sectionTitle} ${s.rise}`}>Good to know</h2>
        <div className={v.faqs}>
          {faqs.map((f) => (
            <details key={f.q} className={v.faq}>
              <summary>{f.q}<span className={v.faqIcon} aria-hidden /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CtaBand heading={<>{config.cta[0]}<br />{config.cta[1]}</>} />
    </div>
  );
}
