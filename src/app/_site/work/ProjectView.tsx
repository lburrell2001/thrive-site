'use client';

// A redesigned project page. Every section past the hero is optional and
// appears only when the case study has it, in the same order as the live
// page: overview and numbers, hero image, challenge, approach, pages,
// the work, growth (social accounts), features, design system, mobile, timeline, outcome and quote,
// then the next project and the closing band.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { caseImageUrl, projectCoverSrcSet, projectCoverThumb } from '@/lib/storage';
import type { CaseImage, CaseShowcase, CaseStudy } from '../../work/caseStudies';
import CtaBand from '../CtaBand';
import Growth from './Growth';
import { rd } from '../links';
import { useReveal } from '../useReveal';
import s from '../redesign.module.css';
import p from './project.module.css';

const TONES = [s.bMagenta, s.bOrange, s.bBlue, s.bMint, s.bPurple];
const tone = (i: number) => TONES[i % TONES.length];

/** A video (a reel, a promo) plays muted on a loop while it's on screen and pauses off it,
 *  so a page of reels doesn't play them all at once. */
function Video({ url, alt }: { url: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  // #t=0.1 makes browsers show the first frame before it plays.
  return <video ref={ref} src={`${url}#t=0.1`} muted loop playsInline preload="metadata" aria-label={alt} />;
}

function Media({ img, width = 1400, eager }: { img: CaseImage; width?: number; eager?: boolean }) {
  const url = caseImageUrl(img.src, width);
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return <Video url={url} alt={img.alt} />;
  return <img src={url} alt={img.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

function Browser({ img, host }: { img: CaseImage; host: string }) {
  return (
    <div className={p.browser}>
      <div className={p.browserBar} aria-hidden><span /><span /><span />{host && <em>{host}</em>}</div>
      <Media img={img} width={1800} />
    </div>
  );
}

function Phone({ img }: { img: CaseImage }) {
  return <div className={p.phone}><Media img={img} width={640} /></div>;
}

/** A tile in a grid/wide/posts group. A phone screenshot (tall and narrow) gets
 *  a phone frame instead of being cropped. */
function Tile({ img, layout }: { img: CaseImage; layout: string }) {
  const [phone, setPhone] = useState(false);
  const check = (el: HTMLImageElement) => { if (el.naturalWidth && el.naturalHeight / el.naturalWidth >= 1.6) setPhone(true); };
  const url = caseImageUrl(img.src, layout === 'wide' ? 1800 : 1000);
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  return (
    <figure className={`${p.tile} ${phone ? p.tilePhone : ''} ${s.rise}`}>
      {isVideo ? <Media img={img} width={layout === 'wide' ? 1800 : 1000} /> : phone ? (
        <span className={p.tilePhoneFrame}><img src={caseImageUrl(img.src, 640)} alt={img.alt} loading="lazy" decoding="async" /></span>
      ) : (
        <img src={url} alt={img.alt} loading="lazy" decoding="async"
          onLoad={(e) => check(e.currentTarget)} ref={(el) => { if (el?.complete) check(el); }} />
      )}
      {img.caption && <figcaption>{img.caption}</figcaption>}
    </figure>
  );
}

function Showcase({ block }: { block: CaseShowcase }) {
  const layout = block.layout ?? 'grid';
  return (
    <div className={p.showcase}>
      {(block.title || block.text) && (
        <div className={p.showcaseHead}>
          {block.title && <h3 className={p.smallTitle}>{block.title}</h3>}
          {block.text && <p className={p.bodyText}>{block.text}</p>}
        </div>
      )}
      {layout === 'phones' ? (
        <div className={p.phones}>
          {block.images.map((img) => (
            <figure key={img.src} className={`${p.phoneFig} ${s.rise}`}>
              <Phone img={img} />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : (
        <div className={`${p.tiles} ${p[`tiles_${layout}`]}`}>
          {block.images.map((img) => <Tile key={img.src} img={img} layout={layout} />)}
        </div>
      )}
    </div>
  );
}

export default function ProjectView({ cs, title, next }: {
  cs: CaseStudy;
  title: string;
  next: { slug: string; title: string; category: string | null } | null;
}) {
  const root = useReveal<HTMLDivElement>();
  const host = cs.liveUrl ? new URL(cs.liveUrl).host.replace(/^www\./, '') : '';
  const firstLink = cs.pages?.length ? '#pages' : cs.showcase?.length ? '#work' : '#overview';
  const meta = [...cs.meta, ...(cs.stack?.length ? [{ label: 'Built with', value: cs.stack.join(' · ') }] : [])];

  return (
    <div ref={root}>
      {/* ── Hero ── */}
      <section className={p.hero}>
        <h1 className={`${s.display} ${p.title}`}>{cs.client}</h1>
        <div className={p.heroRow}>
          <p className={p.headline}>{cs.headline}</p>
          <div>
            <p className={`${s.leadText} ${p.lede}`}>{cs.lede}</p>
            <div className={p.actions}>
              {cs.liveUrl && <a href={cs.liveUrl} target="_blank" rel="noopener" className={`${s.pill} ${s.pillBig}`}>Visit the live site ↗</a>}
              <a href={firstLink} className={`${s.pill} ${s.pillBig} ${cs.liveUrl ? s.pillOutline : ''}`}>{cs.pages?.length ? 'See the pages ↓' : 'See the work ↓'}</a>
            </div>
          </div>
        </div>
        <div className={p.cover}><img src={projectCoverThumb(cs.slug, 2000)} srcSet={projectCoverSrcSet(cs.slug)} sizes="100vw" alt={`${title} cover`} fetchPriority="high" /></div>
      </section>

      {/* ── At a glance ── */}
      <dl className={p.meta} style={{ '--cols': Math.min(meta.length, 5) } as React.CSSProperties}>
        {meta.map((m, i) => (
          <div key={m.label} className={`${p.metaItem} ${tone(i)}`}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>

      {/* ── Overview ── */}
      <section id="overview" className={p.section}>
        <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The project</h2>
        <div className={cs.numbers?.length ? p.split : undefined}>
          <div className={p.bodyText}>{cs.about.map((t) => <p key={t.slice(0, 30)}>{t}</p>)}</div>
          {cs.numbers?.length ? (
            <div className={p.numbers}>
              {cs.numbers.map((n, i) => (
                <div key={n.label} className={`${p.number} ${tone(i)} ${s.rise}`}>
                  <span className={p.numberValue}>{n.value}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {cs.heroImage && <div className={`${p.wideImage} ${s.rise}`}><Media img={cs.heroImage} width={2000} /></div>}

      {/* ── Challenge ── */}
      {cs.challenge && (
        <section id="challenge" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The challenge</h2>
          <p className={`${s.leadText} ${p.intro}`}>{cs.challenge.intro}</p>
          {cs.challenge.goals?.length ? (
            <div className={p.cards}>
              {cs.challenge.goals.map((g, i) => (
                <article key={g.title} className={`${p.card} ${tone(i)} ${s.rise}`} style={{ '--d': `${(i % 3) * 80}ms` } as React.CSSProperties}>
                  <h3 className={p.smallTitle}>{g.title}</h3>
                  <p>{g.text}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* ── Approach ── */}
      {cs.approach && (
        <section id="approach" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The approach</h2>
          {cs.approach.intro && <p className={`${s.leadText} ${p.intro}`}>{cs.approach.intro}</p>}
          <ol className={p.steps}>
            {cs.approach.steps.map((st, i) => (
              <li key={st.title} className={`${p.step} ${tone(i)} ${s.rise}`} style={{ '--d': `${(i % 4) * 80}ms` } as React.CSSProperties}>
                <span className={p.stepNo}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={p.smallTitle}>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── The pages ── */}
      {cs.pages?.length ? (
        <section id="pages" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The pages</h2>
          <div className={p.pages}>
            {cs.pages.map((pg, i) => (
              <article key={pg.title} className={`${p.page} ${i % 2 ? p.pageFlip : ''}`}>
                <div className={p.pageText}>
                  <h3 className={p.smallTitle}>{pg.title}</h3>
                  <p className={p.bodyText}>{pg.text}</p>
                </div>
                <div className={`${p.pageShots} ${s.rise}`}>
                  <Browser img={pg.desktop} host={host} />
                  {pg.mobile && <div className={p.pagePhone}><Phone img={pg.mobile} /></div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── The work ── */}
      {cs.showcase?.length ? (
        <section id="work" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The work</h2>
          {cs.showcase.map((b, i) => <Showcase key={b.title ?? i} block={b} />)}
        </section>
      ) : null}

      {/* ── Growth (social media results) ── */}
      {cs.growth && <Growth growth={cs.growth} Phone={Phone} />}

      {/* ── Features ── */}
      {cs.features?.length ? (
        <section id="features" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>Features</h2>
          <div className={p.cards}>
            {cs.features.map((f, i) => (
              <article key={f.title} className={`${p.card} ${tone(i)} ${s.rise}`} style={{ '--d': `${(i % 3) * 80}ms` } as React.CSSProperties}>
                <h3 className={p.smallTitle}>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Design system ── */}
      {cs.design && (
        <section id="design" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>Design system</h2>
          <p className={`${s.leadText} ${p.intro}`}>{cs.design.intro}</p>
          {cs.design.colors?.length ? (
            <div className={p.swatches}>
              {cs.design.colors.map((c) => (
                <div key={c.hex} className={`${p.swatch} ${s.rise}`}>
                  <span className={p.chip} style={{ background: c.hex }} />
                  <strong>{c.name}</strong>
                  <span className={p.hex}>{c.hex.toUpperCase()}</span>
                </div>
              ))}
            </div>
          ) : null}
          {(cs.design.type || cs.design.patterns?.length) && (
            <div className={p.cards}>
              {cs.design.type && (
                <article className={`${p.card} ${p.outlineCard}`}>
                  <h3 className={p.smallTitle}>Type</h3>
                  <p>{cs.design.type}</p>
                </article>
              )}
              {cs.design.patterns?.map((pt) => (
                <article key={pt.title} className={`${p.card} ${p.outlineCard}`}>
                  <h3 className={p.smallTitle}>{pt.title}</h3>
                  <p>{pt.text}</p>
                </article>
              ))}
            </div>
          )}
          {cs.design.fullPages?.length ? (
            <div className={`${p.tiles} ${p.tiles_grid}`} style={{ marginTop: 'clamp(24px, 3vw, 44px)' }}>
              {cs.design.fullPages.map((img) => (
                <figure key={img.src} className={`${p.tile} ${p.tall}`}><Media img={img} width={1000} /></figure>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* ── Mobile ── */}
      {cs.mobile && (
        <section id="mobile" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>On phones</h2>
          <p className={`${s.leadText} ${p.intro}`}>{cs.mobile.intro}</p>
          <div className={p.phones}>{cs.mobile.shots.map((img) => <Phone key={img.src} img={img} />)}</div>
        </section>
      )}

      {/* ── Timeline ── */}
      {cs.timeline?.length ? (
        <section id="timeline" className={p.section}>
          <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>Timeline</h2>
          <ol className={p.timeline}>
            {cs.timeline.map((t, i) => (
              <li key={t.when + t.title} className={s.rise}>
                <span className={`${p.when} ${tone(i)}`}>{t.when}</span>
                <div><h3 className={p.smallTitle}>{t.title}</h3><p className={p.bodyText}>{t.text}</p></div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ── Outcome ── */}
      <section id="outcome" className={`${p.outcome} ${s.bBlue}`}>
        <h2 className={`${s.display} ${p.sectionTitle}`}>The outcome</h2>
        <div className={p.outcomeGrid}>
          <div className={p.bodyText}>
            {cs.outcome.map((t) => <p key={t.slice(0, 30)}>{t}</p>)}
            {cs.related && <p>{cs.related.before}<Link href={cs.related.href} className={p.inlineLink}>{cs.related.label}</Link>{cs.related.after}</p>}
          </div>
          <div>
            {cs.quote && (
              <figure className={p.quote}>
                <blockquote>“{cs.quote.text}”</blockquote>
                <figcaption>{cs.quote.author}</figcaption>
              </figure>
            )}
            {cs.liveUrl && <a href={cs.liveUrl} target="_blank" rel="noopener" className={`${s.pill} ${s.pillBig} ${p.liveBtn}`}>Visit {host} ↗</a>}
          </div>
        </div>
      </section>

      {/* ── Next project ── */}
      {next && (
        <Link href={rd(`/work/${next.slug}`)} className={p.next}>
          <span className={`${s.display} ${p.nextTitle}`}>Next: {next.title}</span>
          {next.category && <span className={p.nextCat}>{next.category.split(',')[0]}</span>}
          <span className={p.nextArrow} aria-hidden>→</span>
        </Link>
      )}

      <CtaBand />
    </div>
  );
}
