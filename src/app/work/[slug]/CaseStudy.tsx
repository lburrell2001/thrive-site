/* eslint-disable @next/next/no-img-element */
import { caseImageUrl, projectCoverThumb } from "@/lib/storage";
import type { CaseImage, CaseShowcase, CaseStudy as CaseStudyData } from "../caseStudies";
import s from "./CaseStudy.module.css";

// Full case-study layout for projects with an entry in caseStudies.ts. Every
// section past the header is optional; the sticky menu lists only the ones a
// project has, numbered in order, so a long story stays easy to follow.

const ACCENTS = ["#e50586", "#3b43af", "#ea6b2c", "#861dc5"];

function Media({ img, width, priority }: { img: CaseImage; width?: number; priority?: boolean }) {
  const url = caseImageUrl(img.src, width);
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} muted loop autoPlay playsInline preload="metadata" aria-label={img.alt} />;
  }
  return <img src={url} alt={img.alt} loading={priority ? "eager" : "lazy"} decoding="async" />;
}

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
      <Media img={img} />
    </div>
  );
}

function Phone({ img, className = "" }: { img: CaseImage; className?: string }) {
  return (
    <div className={`${s.phone} ${className}`}>
      <Media img={img} width={640} />
    </div>
  );
}

function Showcase({ block }: { block: CaseShowcase }) {
  const layout = block.layout ?? "grid";
  return (
    <div className={s.showcase}>
      <h3 className={s.showcaseTitle}>{block.title}</h3>
      {block.text && <p className={s.showcaseText}>{block.text}</p>}
      {layout === "phones" ? (
        <div className={s.phoneRow}>
          {block.images.map((img) => <Phone key={img.src} img={img} />)}
        </div>
      ) : (
        <div className={`${s.tiles} ${s[`tiles_${layout}`]}`}>
          {block.images.map((img, i) => (
            <figure
              key={img.src}
              className={s.tile}
              style={layout === "posts" ? { ["--tilt" as string]: `${[-1.5, 1.2, -0.8, 1.6, -1.2, 0.9][i % 6]}deg` } : undefined}
            >
              <Media img={img} width={layout === "wide" ? 1600 : 900} />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CaseStudy({ cs, title, category }: { cs: CaseStudyData; title: string; category: string }) {
  const host = cs.liveUrl ? new URL(cs.liveUrl).host : "";

  // The sections this project has, in reading order.
  const sections: { id: string; label: string }[] = [
    { id: "overview", label: "Overview" },
    cs.challenge && { id: "challenge", label: "The challenge" },
    cs.approach && { id: "approach", label: "The approach" },
    cs.pages?.length && { id: "pages", label: "The pages" },
    cs.showcase?.length && { id: "work", label: "The work" },
    cs.features?.length && { id: "features", label: "Features" },
    cs.design && { id: "design", label: "Design system" },
    cs.mobile && { id: "mobile", label: "Mobile" },
    cs.timeline?.length && { id: "timeline", label: "Timeline" },
    { id: "outcome", label: "Outcome" },
  ].filter(Boolean) as { id: string; label: string }[];
  const num = (id: string) => sections.findIndex((x) => x.id === id) + 1;
  const firstLink = cs.pages?.length ? "#pages" : cs.showcase?.length ? "#work" : "#overview";

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
            <a href={firstLink} className={cs.liveUrl ? s.btnGhost : s.btnPrimary}>
              {cs.pages?.length ? "See the pages ↓" : "See the work ↓"}
            </a>
          </div>
        </div>
        <div className={s.heroImg}>
          <img src={projectCoverThumb(cs.slug, 1400)} alt={`${title} cover`} fetchPriority="high" />
        </div>
      </section>

      {/* ── META ── */}
      <dl className={s.meta} style={{ ["--cols" as string]: cs.meta.length + (cs.stack?.length ? 1 : 0) }}>
        {cs.meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
        {cs.stack?.length ? (
          <div>
            <dt>Built with</dt>
            <dd>{cs.stack.join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      {/* ── SECTION MENU ── */}
      <nav className={s.toc} aria-label="Case study sections">
        <ol>
          {sections.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`}><span>{String(i + 1).padStart(2, "0")}</span>{sec.label}</a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ── OVERVIEW ── */}
      <section id="overview" className={s.section}>
        <SectionHead n={num("overview")} eyebrow="The project" title="Overview" />
        <div className={cs.numbers?.length ? s.overviewGrid : undefined}>
          <div className={s.prose}>
            {cs.about.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}
          </div>
          {cs.numbers?.length ? (
            <div className={s.numbers}>
              {cs.numbers.map((n, i) => (
                <div key={n.label} className={s.number}>
                  <span style={{ color: ACCENTS[i % ACCENTS.length] }}>{n.value}</span>
                  <p>{n.label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {cs.heroImage && (
        <figure className={s.mockupBand}>
          <Media img={cs.heroImage} width={2000} />
        </figure>
      )}

      {/* ── CHALLENGE ── */}
      {cs.challenge && (
        <section id="challenge" className={`${s.section} ${s.sand}`}>
          <SectionHead n={num("challenge")} eyebrow="What the work had to do" title="The challenge" />
          <p className={s.intro}>{cs.challenge.intro}</p>
          {cs.challenge.goals?.length ? (
            <div className={s.goals}>
              {cs.challenge.goals.map((g, i) => (
                <div key={g.title} className={s.goal}>
                  <span className={s.goalBar} style={{ background: ACCENTS[i % ACCENTS.length] }} />
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* ── APPROACH ── */}
      {cs.approach && (
        <section id="approach" className={`${s.section} ${s.dark}`}>
          <SectionHead n={num("approach")} eyebrow="How Thrive worked" title="The approach" dark />
          {cs.approach.intro && <p className={`${s.intro} ${s.introDark}`}>{cs.approach.intro}</p>}
          <ol className={s.steps}>
            {cs.approach.steps.map((st, i) => (
              <li key={st.title}>
                <span style={{ color: ACCENTS[i % ACCENTS.length] }}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── PAGES ── */}
      {cs.pages?.length ? (
        <section id="pages" className={s.section}>
          <SectionHead n={num("pages")} eyebrow={host ? `A tour of ${host}` : "A tour of the screens"} title="The pages" />
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
      ) : null}

      {/* ── SHOWCASE ── */}
      {cs.showcase?.length ? (
        <section id="work" className={s.section}>
          <SectionHead n={num("work")} eyebrow="What Thrive made" title="The work" />
          <div className={s.showcases}>
            {cs.showcase.map((b) => <Showcase key={b.title} block={b} />)}
          </div>
        </section>
      ) : null}

      {/* ── FEATURES ── */}
      {cs.features?.length ? (
        <section id="features" className={`${s.section} ${s.dark}`}>
          <SectionHead n={num("features")} eyebrow="Behind the scenes" title="What it does" dark />
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
      ) : null}

      {/* ── DESIGN ── */}
      {cs.design && (
        <section id="design" className={s.section}>
          <SectionHead n={num("design")} eyebrow="Look and feel" title="Design system" />
          <p className={s.intro}>{cs.design.intro}</p>
          {cs.design.colors?.length ? (
            <div className={s.swatches}>
              {cs.design.colors.map((c) => (
                <div key={c.hex + c.name} className={s.swatch}>
                  <span style={{ background: c.hex }} />
                  <strong>{c.name}</strong>
                  <code>{c.hex}</code>
                </div>
              ))}
            </div>
          ) : null}
          {(cs.design.type || cs.design.patterns?.length) && (
            <div className={s.patterns}>
              {cs.design.type && (
                <div className={s.pattern}>
                  <h3>Type</h3>
                  <p>{cs.design.type}</p>
                </div>
              )}
              {cs.design.patterns?.map((p) => (
                <div key={p.title} className={s.pattern}>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          )}
          {cs.design.fullPages?.length ? (
            <>
              <p className={s.hint}>Full pages. Hover over one (or scroll inside it on a phone) to see the whole page.</p>
              <div className={s.scrolls}>
                {cs.design.fullPages.map((img) => (
                  <figure key={img.src} className={s.scroll}>
                    <div className={s.scrollFrame} tabIndex={0}>
                      <Media img={img} width={1200} />
                    </div>
                    {img.caption && <figcaption>{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}

      {/* ── MOBILE ── */}
      {cs.mobile && (
        <section id="mobile" className={`${s.section} ${s.sand}`}>
          <SectionHead n={num("mobile")} eyebrow="On the go" title="Made for phones" />
          <p className={s.intro}>{cs.mobile.intro}</p>
          <div className={s.phoneRow}>
            {cs.mobile.shots.map((img) => <Phone key={img.src} img={img} />)}
          </div>
        </section>
      )}

      {/* ── TIMELINE ── */}
      {cs.timeline?.length ? (
        <section id="timeline" className={s.section}>
          <SectionHead n={num("timeline")} eyebrow="How it came together" title="Timeline" />
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
      ) : null}

      {/* ── OUTCOME ── */}
      <section id="outcome" className={`${s.section} ${s.outcome}`}>
        <SectionHead n={num("outcome")} eyebrow="Where it landed" title="The outcome" dark />
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
          <a href="/contact" className={cs.liveUrl ? s.btnGhost : s.btnLight}>Start your project →</a>
        </div>
      </section>
    </div>
  );
}
