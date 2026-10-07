/* eslint-disable @next/next/no-img-element */
import { projectCoverThumb } from "@/lib/storage";
import type { CaseImage, CaseStudy as CaseStudyData } from "../caseStudies";
import s from "./CaseStudy.module.css";

// Full case-study layout for projects with an entry in caseStudies.ts. A
// sticky section menu keeps a long story easy to follow; every section is
// numbered and opens with a one-line eyebrow saying what it covers.

const ACCENTS = ["#e50586", "#3b43af", "#ea6b2c", "#861dc5"];

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "challenge", label: "The challenge" },
  { id: "pages", label: "The pages" },
  { id: "features", label: "Features" },
  { id: "design", label: "Design system" },
  { id: "mobile", label: "Mobile" },
  { id: "timeline", label: "Timeline" },
  { id: "outcome", label: "Outcome" },
];

function SectionHead({ n, eyebrow, title, dark }: { n: number; eyebrow: string; title: string; dark?: boolean }) {
  return (
    <div className={s.sectionHead}>
      <span className={s.sectionNum} style={{ color: ACCENTS[n % ACCENTS.length] }}>{String(n).padStart(2, "0")}</span>
      <div>
        <p className={`${s.eyebrow} ${dark ? s.eyebrowDark : ""}`}>{eyebrow}</p>
        <h2 className={s.h2}>{title}</h2>
      </div>
    </div>
  );
}

function Browser({ img, url }: { img: CaseImage; url: string }) {
  return (
    <div className={s.browser}>
      <div className={s.browserBar} aria-hidden>
        <span /><span /><span />
        <em>{url}</em>
      </div>
      <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
    </div>
  );
}

function Phone({ img, className = "" }: { img: CaseImage; className?: string }) {
  return (
    <div className={`${s.phone} ${className}`}>
      <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
    </div>
  );
}

export default function CaseStudy({ cs, title, category }: { cs: CaseStudyData; title: string; category: string }) {
  const host = cs.liveUrl ? new URL(cs.liveUrl).host : "";

  return (
    <div className={s.page}>
      {/* ── HERO ── */}
      <section className={s.hero}>
        <div className={s.heroText}>
          <a href="/portfolio" className={s.back}>← Portfolio</a>
          <span className={s.chip}>{category}</span>
          <h1 className={s.h1}>{title}</h1>
          <p className={s.headline}>{cs.headline}</p>
          <p className={s.lede}>{cs.lede}</p>
          <div className={s.actions}>
            {cs.liveUrl && (
              <a href={cs.liveUrl} target="_blank" rel="noopener" className={s.btnPrimary}>Visit the live site ↗</a>
            )}
            <a href="#pages" className={s.btnGhost}>See the pages ↓</a>
          </div>
        </div>
        <div className={s.heroImg}>
          <img src={projectCoverThumb(cs.slug, 1400)} alt={`${title} website on a laptop`} fetchPriority="high" />
        </div>
      </section>

      {/* ── META ── */}
      <dl className={s.meta}>
        {cs.meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
        <div>
          <dt>Built with</dt>
          <dd>{cs.stack.join(" · ")}</dd>
        </div>
      </dl>

      {/* ── SECTION MENU ── */}
      <nav className={s.toc} aria-label="Case study sections">
        <ol>
          {SECTIONS.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`}><span>{String(i + 1).padStart(2, "0")}</span>{sec.label}</a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ── 01 OVERVIEW ── */}
      <section id="overview" className={s.section}>
        <SectionHead n={1} eyebrow="Who the client is" title="Overview" />
        <div className={s.overviewGrid}>
          <div className={s.prose}>
            {cs.about.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}
          </div>
          <div className={s.numbers}>
            {cs.numbers.map((n, i) => (
              <div key={n.label} className={s.number}>
                <span style={{ color: ACCENTS[i % ACCENTS.length] }}>{n.value}</span>
                <p>{n.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <figure className={s.mockupBand}>
        <img src={cs.heroImage.src} alt={cs.heroImage.alt} loading="lazy" />
      </figure>

      {/* ── 02 CHALLENGE ── */}
      <section id="challenge" className={`${s.section} ${s.sand}`}>
        <SectionHead n={2} eyebrow="What the site had to do" title="The challenge" />
        <p className={s.intro}>{cs.challenge.intro}</p>
        <div className={s.goals}>
          {cs.challenge.goals.map((g, i) => (
            <div key={g.title} className={s.goal}>
              <span className={s.goalBar} style={{ background: ACCENTS[i % ACCENTS.length] }} />
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03 PAGES ── */}
      <section id="pages" className={s.section}>
        <SectionHead n={3} eyebrow={`A tour of ${host || "the site"}`} title="The pages" />
        <div className={s.pageList}>
          {cs.pages.map((pg, i) => (
            <article key={pg.title} className={`${s.pageRow} ${i % 2 ? s.flip : ""}`}>
              <div className={s.pageShots}>
                <Browser img={pg.desktop} url={host} />
                {pg.mobile && <Phone img={pg.mobile} className={s.pagePhone} />}
              </div>
              <div className={s.pageText}>
                <span className={s.pageNum} style={{ background: ACCENTS[i % ACCENTS.length] }}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{pg.title}</h3>
                <p>{pg.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── 04 FEATURES ── */}
      <section id="features" className={`${s.section} ${s.dark}`}>
        <SectionHead n={4} eyebrow="Behind the scenes" title="Built to run itself" dark />
        <div className={s.features}>
          {cs.features.map((f, i) => (
            <div key={f.title} className={s.feature}>
              <span className={s.featureDot} style={{ background: ACCENTS[i % ACCENTS.length] }} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 DESIGN ── */}
      <section id="design" className={s.section}>
        <SectionHead n={5} eyebrow="Look and feel" title="Design system" />
        <p className={s.intro}>{cs.design.intro}</p>
        <div className={s.swatches}>
          {cs.design.colors.map((c) => (
            <div key={c.hex} className={s.swatch}>
              <span style={{ background: c.hex }} />
              <strong>{c.name}</strong>
              <code>{c.hex}</code>
            </div>
          ))}
        </div>
        <div className={s.patterns}>
          <div className={s.pattern}>
            <h3>Type</h3>
            <p>{cs.design.type}</p>
          </div>
          {cs.design.patterns.map((p) => (
            <div key={p.title} className={s.pattern}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <p className={s.hint}>Full pages. Hover over one (or scroll inside it on a phone) to see the whole page.</p>
        <div className={s.scrolls}>
          {cs.design.fullPages.map((img) => (
            <figure key={img.src} className={s.scroll}>
              <div className={s.scrollFrame} tabIndex={0}>
                <img src={img.src} alt={img.alt} loading="lazy" />
              </div>
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>

      {/* ── 06 MOBILE ── */}
      <section id="mobile" className={`${s.section} ${s.sand}`}>
        <SectionHead n={6} eyebrow="On the go" title="Made for phones" />
        <p className={s.intro}>{cs.mobile.intro}</p>
        <div className={s.phoneRow}>
          {cs.mobile.shots.map((img) => <Phone key={img.src} img={img} />)}
        </div>
      </section>

      {/* ── 07 TIMELINE ── */}
      <section id="timeline" className={s.section}>
        <SectionHead n={7} eyebrow="How it came together" title="Timeline" />
        <ol className={s.timeline}>
          {cs.timeline.map((t, i) => (
            <li key={t.when + t.title}>
              <span className={s.tlDot} style={{ background: ACCENTS[i % ACCENTS.length] }} />
              <p className={s.tlWhen}>{t.when}</p>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 08 OUTCOME ── */}
      <section id="outcome" className={`${s.section} ${s.outcome}`}>
        <SectionHead n={8} eyebrow="Where it landed" title="The outcome" dark />
        <div className={s.outcomeText}>
          {cs.outcome.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}
        </div>
        {cs.quote && (
          <blockquote className={s.quote}>
            <p>&ldquo;{cs.quote.text}&rdquo;</p>
            <cite>— {cs.quote.author}</cite>
          </blockquote>
        )}
        <div className={s.actions}>
          {cs.liveUrl && (
            <a href={cs.liveUrl} target="_blank" rel="noopener" className={s.btnLight}>Visit {host} ↗</a>
          )}
          <a href="/contact" className={s.btnGhost}>Start your project →</a>
        </div>
      </section>
    </div>
  );
}
