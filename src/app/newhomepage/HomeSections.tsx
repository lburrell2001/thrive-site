"use client";

// The homepage's sections below the hero, in the same sticker look as the hero.
import { useEffect, useRef } from "react";
import { storageUrl } from "@/lib/storage";
import s from "./HomeSections.module.css";

// Each section watches its own fade-ins, so they show however the section was mounted.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(`.${s.reveal}`);
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add(s.shown); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return ref;
}

export type HomeService = {
  tag: string;
  name: string;
  sub: string;
  desc: string;
  href: string;
  media: { type: "image" | "video"; src: string; local?: boolean; poster?: string };
};

// Same colours as the hero stickers, so each service keeps its colour down the page.
const SERVICE_TONES = [s.toPink, s.toGreen, s.toOrange, s.toBlue, s.toBlack];

const TAPE = "THRIVE CREATIVE STUDIOS ✦ BOLD BRANDING ✦ WEB DEVELOPMENT ✦ UX DESIGN ✦ SOCIAL MEDIA ✦ PHOTOGRAPHY ✦ DALLAS, TX ✦ BUILT FOR THE BOLD ✦ ";

const STEPS = [
  { title: "Listen", text: "We start by listening. Deep dives into your brand, your audience, your goals — and the story only you can tell." },
  { title: "Strategize", text: "Strategy first. We build a creative brief and direction that becomes the north star for every decision we make." },
  { title: "Create", text: "This is where we create. Bold concepts, refined execution, and relentless attention to every detail." },
  { title: "Launch & grow", text: "Launch-ready deliverables — and ongoing partnership to keep your brand growing long after handoff." },
];

const QUOTES = [
  { text: "Thrive completely transformed how our brand shows up. The energy, the vision, the execution — nothing short of exceptional.", who: "DJ Mastamind" },
  { text: "Working with Thrive felt like working with people who actually understood our community.", who: "Classic Rollers" },
  { text: "The work they did set us apart immediately. Bold, intentional, and exactly right.", who: "The Burrell Group" },
];

function Tape({ reverse }: { reverse?: boolean }) {
  return (
    <div className={`${s.tape} ${reverse ? s.tapeB : s.tapeA}`} aria-hidden>
      <div className={`${s.tapeTrack} ${reverse ? s.tapeReverse : ""}`}>
        <span>{TAPE}</span>
        <span>{TAPE}</span>
      </div>
    </div>
  );
}

/** Tape strip, about and services — sits between the hero and the work reel. */
export function HomeIntro({ services }: { services: HomeService[] }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className={s.wrap} ref={ref}>
      <div className={s.tapes}>
        <Tape />
        <Tape reverse />
      </div>

      {/* ── ABOUT ── */}
      <section className={s.about}>
        <h2 className={`${s.aboutH} ${s.reveal}`}>
          We do <span className={s.almost}>almost</span> everything
        </h2>

        <figure className={`${s.polaroid} ${s.reveal}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lauren-portrait.jpg" alt="Lauren Burrell, founder of Thrive Creative Studios" loading="lazy" />
          <figcaption>Lauren · founder</figcaption>
          <span className={`${s.badge} ${s.badgeGreen} ${s.badgeA}`}>Black<br />owned</span>
          <span className={`${s.badge} ${s.badgeOrange} ${s.badgeB}`}>Dallas<br />TX</span>
        </figure>

        <p className={`${s.aboutP} ${s.reveal}`}>
          Thrive Creative Studios is a full-service creative agency rooted in representation. We exist because Black
          creatives — especially Black women — have always been forces in the creative world, but not always given the
          seat, the stage, or the spotlight they deserve. <strong>So we built the room ourselves.</strong>
        </p>
      </section>

      {/* ── SERVICES ── */}
      <section className={s.services} id="services">
        <p className={s.eyebrow}>Take a peek at</p>
        <h2 className={s.sectionH}>Our services</h2>
        <p className={s.lede}>
          Whether you need a quick turnaround brand identity or the whole dream creative experience, I&apos;ll build you
          something bold, strategic, and fun to show off.
        </p>

        <div className={s.stack}>
          {services.map((svc, i) => (
            <a
              key={svc.href}
              href={svc.href}
              className={`${s.card} ${SERVICE_TONES[i % SERVICE_TONES.length]}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className={s.cardMedia}>
                {svc.media.type === "video" ? (
                  <video autoPlay muted loop playsInline preload="metadata" poster={svc.media.poster}>
                    <source src={storageUrl(`videos/${svc.media.src}`)} type="video/mp4" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={svc.media.local ? svc.media.src : storageUrl(svc.media.src)} alt="" loading="lazy" />
                )}
                <span className={s.cardNum}>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className={s.cardBody}>
                <h3 className={s.cardName}>{svc.name}</h3>
                <p className={s.cardSub}>{svc.sub}</p>
                <p className={s.cardDesc}>{svc.desc}</p>
                <span className={s.cardBtn}>Gimme the details →</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Process, testimonials and the closing call to action — after the work reel. */
export function HomeOutro() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className={s.wrap} ref={ref}>
      {/* ── PROCESS ── */}
      <section className={s.process}>
        <p className={s.eyebrow}>From first call to launch</p>
        <h2 className={s.sectionH}>How it works</h2>
        <ol className={s.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={`${s.step} ${s.reveal}`}>
              <span className={`${s.stepNum} ${SERVICE_TONES[i]}`}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepText}>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={s.quotes}>
        <p className={s.eyebrow}>Don&apos;t take our word for it</p>
        <h2 className={s.sectionH}>Client love</h2>
        <div className={s.quoteRail}>
          {QUOTES.map((q, i) => (
            <figure key={q.who} className={`${s.quote} ${[s.toPink, s.toBlue, s.toGreen][i]}`}>
              <span className={s.quoteMark} aria-hidden>“</span>
              <blockquote>{q.text}</blockquote>
              <figcaption>— {q.who}</figcaption>
            </figure>
          ))}
        </div>
        <p className={s.swipeHint} aria-hidden>Swipe →</p>
      </section>

      {/* ── CTA ── */}
      <section className={s.cta}>
        <a href="/contact" className={s.ctaSticker} aria-label="Let's talk">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lauren-portrait.jpg" alt="" loading="lazy" />
          <svg viewBox="0 0 100 100" aria-hidden>
            <defs>
              <path id="cta-ring" d="M8.5,50 a41.5,41.5 0 1,1 83,0 a41.5,41.5 0 1,1 -83,0" />
            </defs>
            <circle cx={50} cy={50} r={41.5} className={s.ctaRing} />
            <circle cx={50} cy={50} r={33} className={s.ctaRingEdge} />
            <text className={s.ctaRingText} fontSize={9.5} dominantBaseline="central">
              <textPath href="#cta-ring" textLength={258} lengthAdjust="spacing">LET&apos;S TALK ✦ LET&apos;S TALK ✦ LET&apos;S TALK ✦ </textPath>
            </text>
          </svg>
        </a>

        <h2 className={s.ctaH}>
          <span>Let&apos;s build</span>
          <span>something</span>
          <span className={s.ctaBold}>bold.</span>
        </h2>
        <p className={s.ctaP}>Tell us what you&apos;re dreaming up — we&apos;ll take it from there.</p>
        <a href="/contact" className={s.ctaBtn}>Start a project →</a>
        <a href="mailto:hello@thrivecreativestudios.org" className={s.ctaMail}>or email hello@thrivecreativestudios.org</a>
      </section>
    </div>
  );
}
