"use client";

// The homepage's sections below the hero, in the same sticker look as the hero.
import Link from "next/link";
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

const TAPE = "BRING THE COLOR BACK ✦ BRANDING ✦ WEB DEVELOPMENT ✦ SOCIAL MEDIA ✦ UX/UI DESIGN ✦ PHOTOGRAPHY ✦ DALLAS, TX ✦ NO BEIGE HERE ✦ ";

const STEPS = [
  { title: "Listen", text: "We start by listening. Deep dives into your brand, your audience, your goals — and the story only you can tell." },
  { title: "Strategize", text: "Strategy first. You get a written proposal with the scope, timeline and price before any work begins." },
  { title: "Create", text: "This is where we create. Bold concepts, refined execution, and relentless attention to every detail." },
  { title: "Launch & grow", text: "Launch-ready deliverables — and ongoing partnership to keep your brand growing long after handoff." },
];

const BELIEFS = [
  { line: "Color isn't clutter.", text: "Color is how people feel your brand before they read a word. We use it on purpose." },
  { line: "Bold isn't unprofessional.", text: "You can be taken seriously and still look like yourself. Those were never at odds." },
  { line: "Blending in was never the magic.", text: "The brands people remember are the ones that didn't play it safe. Yours should be one of them." },
];

const ONE_STUDIO = [
  { title: "We design and build", text: "No handing a mockup to a stranger and hoping it survives. The people who design your site are the people who build it." },
  { title: "One team owns it", text: "One team knows your brand inside out, from the first logo sketch to the hundredth post." },
  { title: "It all matches", text: "Your colors, your voice and your story carry from your business card to your homepage to your feed." },
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

/** Two crossed tapes scrolling opposite ways. */
export function TapeStrip() {
  return (
    <div className={s.tapes}>
      <Tape />
      <Tape reverse />
    </div>
  );
}

/** Tape strip, beliefs, who we're for, services and why one studio — between the hero and the work reel. */
export function HomeIntro({ services }: { services: HomeService[] }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className={s.wrap} ref={ref}>
      <TapeStrip />

      {/* ── WHAT WE BELIEVE ── */}
      <section className={s.beliefs}>
        <h2 className={`${s.sectionH} ${s.reveal}`}>What we believe</h2>
        <p className={`${s.lede} ${s.reveal}`}>
          Somewhere along the way, design got quiet. Beige, minimal, safe — until every brand looked like every other
          brand. We think that&apos;s a loss, and we&apos;re here to undo it.
        </p>
        <ol className={s.beliefList}>
          {BELIEFS.map((b, i) => (
            <li key={b.line} className={`${s.belief} ${SERVICE_TONES[i]} ${s.reveal}`}>
              <h3 className={s.beliefLine}>{b.line}</h3>
              <p className={s.beliefText}>{b.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── WHO WE'RE FOR ── */}
      <section className={s.about}>
        <h2 className={`${s.aboutH} ${s.reveal}`}>
          For the founder who&apos;s <span className={s.almost}>still</span> in it
        </h2>

        <figure className={`${s.polaroid} ${s.reveal}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lauren-portrait.jpg" alt="Lauren Burrell, founder of Thrive Creative Studios" loading="lazy" />
          <figcaption>Lauren · founder</figcaption>
          <span className={`${s.badge} ${s.badgeGreen} ${s.badgeA}`}>Black<br />owned</span>
          <span className={`${s.badge} ${s.badgeOrange} ${s.badgeB}`}>Dallas<br />TX</span>
        </figure>

        <div className={`${s.aboutP} ${s.reveal}`}>
          <p>
            We work with founder-led brands — the ones where there&apos;s still a real person behind the business. Small,
            mission-driven, and often Black-owned and women-owned. You started this for a reason, and your brand should
            look like that reason.
          </p>
          <p>
            Black creatives — especially Black women — have always been forces in the creative world, but not always
            given the seat, the stage, or the spotlight they deserve. <strong>So we built the room ourselves.</strong>
          </p>
          <p className={s.roots}>
            We&apos;re based in Dallas, with <Link href="/amarillo-web-design">roots in Amarillo</Link> — our founder&apos;s
            hometown, where we built the website for the{" "}
            <Link href="/work/classic-rollers-car-club">Classic Rollers Car Club</Link>.
          </p>
        </div>
      </section>

      {/* ── NOT FOR EVERYONE ── */}
      <section className={s.notFor}>
        <h2 className={`${s.notForH} ${s.reveal}`}>
          We&apos;re <span>not</span> for everyone.
        </h2>
        <p className={`${s.notForP} ${s.reveal}`}>
          If your business doesn&apos;t have a story, or it got so big the soul left the building, we&apos;re not your
          studio. No hard feelings — there&apos;s no shortage of people who&apos;ll make you look like everyone else.
        </p>
      </section>

      {/* ── SERVICES ── */}
      <section className={s.services} id="services">
        <h2 className={s.sectionH}>What we do</h2>
        <p className={s.lede}>
          Branding, web development, social media, UX/UI design and photography — everything a brand with a story needs
          to show up in full color.
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

      {/* ── WHY ONE STUDIO ── */}
      <section className={s.oneStudio}>
        <h2 className={`${s.sectionH} ${s.reveal}`}>One studio. The whole brand.</h2>
        <p className={`${s.lede} ${s.reveal}`}>
          Most brands get pieced together: a logo from one person, a website from another, social from whoever&apos;s
          free. That&apos;s how a business ends up looking like three different businesses. With us, the same team
          does all of it, so everything looks like it came from the same place — because it did.
        </p>
        <div className={s.oneGrid}>
          {ONE_STUDIO.map((w, i) => (
            <div key={w.title} className={`${s.oneCard} ${[s.toPink, s.toOrange, s.toGreen][i]} ${s.reveal}`}>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
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

      <ClosingCta />
    </div>
  );
}

/** The pink closing call to action with Lauren's spinning "Let's talk" sticker. */
export function ClosingCta() {
  return (
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
        <span>Let&apos;s bring</span>
        <span>the <span className={s.ctaBold}>color</span></span>
        <span>back.</span>
      </h2>
      <p className={s.ctaP}>Tell us your story — we&apos;ll show you what it looks like in full color.</p>
      <a href="/contact" className={s.ctaBtn}>Start a project →</a>
      <a href="mailto:hello@thrivecreativestudios.org" className={s.ctaMail}>or email hello@thrivecreativestudios.org</a>
    </section>
  );
}
