"use client";

import { useEffect, useState } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import styles from "./newhomepage.module.css";
import PublicLayout from "../components/PublicLayout";
import { storageUrl } from "@/lib/storage";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
  display: "swap",
});

const baiJamjuree = Bai_Jamjuree({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-bai",
  display: "swap",
});

const SERVICES = [
  {
    tag: "01 — Digital", name: "DIGITAL DESIGN", sub: "ALL YOURS IN ONLY 2–4 WEEKS",
    desc: "Web design, landing pages, and digital assets built from the ground up — infused with strategy and a visual identity that sets you apart.",
    href: "/services/digital-design",
    media: { type: "video" as const, src: "branding-hero-v2.mp4" },
  },
  {
    tag: "02 — Social", name: "SOCIAL MEDIA", sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "Strategy, content creation, and community management that grows your audience and turns followers into loyal clients.",
    href: "/services/social-media",
    media: { type: "video" as const, src: "hero-social.mp4" },
  },
  {
    tag: "03 — UX", name: "UX DESIGN", sub: "EXPERIENCES PEOPLE ACTUALLY LOVE",
    desc: "Human-centered product design that makes digital experiences feel effortless and intuitive — from wireframes to polished prototypes.",
    href: "/services/ux-design",
    media: { type: "video" as const, src: "ux-hero.mp4" },
  },
  {
    tag: "04 — Brand", name: "BRAND DESIGN", sub: "ALL YOURS IN ONLY 4–6 WEEKS",
    desc: "Complete visual identities — logos, color systems, typography, and brand guidelines — built from the ground up to set you apart in your industry.",
    href: "/services/brand-design",
    media: { type: "video" as const, src: "thrive-hero-v2.mp4" },
  },
  {
    tag: "05 — Photo", name: "PHOTOGRAPHY", sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Brand photography and visual storytelling that captures real culture, real beauty, and real depth — bold, intentional, unforgettable.",
    href: "/services/photography",
    media: { type: "image" as const, src: "/new-thrive/services/photo.png", local: true },
  },
];

export default function NewHomePage() {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let raf: number;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;

        // Hero parallax — scroll-based (drift as you scroll away)
        document.querySelectorAll<HTMLElement>("[data-py]").forEach((el) => {
          const speed = parseFloat(el.dataset.py || "0");
          el.style.transform = `translateY(${y * speed}px)`;
        });
        document.querySelectorAll<HTMLElement>("[data-hx]").forEach((el) => {
          const speed = parseFloat(el.dataset.hx || "0");
          el.style.transform = `translateX(${y * speed}px)`;
        });
        // Glide-in parallax — viewport-relative (elements slide in as section enters view)
        document.querySelectorAll<HTMLElement>("[data-px]").forEach((el) => {
          const speed = parseFloat(el.dataset.px || "0");
          const rect = el.getBoundingClientRect();
          const centerOffset = (rect.top + rect.height / 2) - window.innerHeight / 2;
          el.style.transform = `translateX(${centerOffset * speed}px)`;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <PublicLayout>
    <div className={`${bungee.variable} ${baiJamjuree.variable} ${styles.page}`}>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <span className={`${styles.gh} ${styles.ghA}`}        data-hx="-0.08">A</span>
        <span className={`${styles.gh} ${styles.ghFull}`}     data-py="0.12">FULL</span>
        <span className={`${styles.gh} ${styles.ghService}`}  data-hx="0.10">SERVICE</span>
        <span className={`${styles.gh} ${styles.ghCreative}`} data-hx="-0.06">CREATIVE</span>
        <span className={`${styles.gh} ${styles.ghAgency}`}   data-hx="0.08">AGENCY</span>
<div className={styles.heroWordmark}>
          <img src="/new-thrive/logo.svg" alt="Thrive" className={styles.heroThrive} />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className={styles.about} id="about">
        <div className={styles.aboutMarqueeWrap}>
          <svg viewBox="0 0 1440 14" className={styles.aboutWave} preserveAspectRatio="none">
            <path d="M0,7 C90,0 180,14 270,7 C360,0 450,14 540,7 C630,0 720,14 810,7 C900,0 990,14 1080,7 C1170,0 1260,14 1350,7 C1395,3.5 1418,1 1440,7 L1440,14 L0,14 Z" fill="#0a0a0a"/>
            <path d="M0,7 C90,0 180,14 270,7 C360,0 450,14 540,7 C630,0 720,14 810,7 C900,0 990,14 1080,7 C1170,0 1260,14 1350,7 C1395,3.5 1418,1 1440,7" fill="none" stroke="#e50586" strokeWidth="2.5"/>
          </svg>
          <div className={styles.aboutMarqueeTrack}>
            {[0,1].map(i => (
              <span key={i} aria-hidden={i > 0 ? true : undefined}>
                THRIVE CREATIVE STUDIOS &nbsp;✦&nbsp; BOLD BRANDING &nbsp;✦&nbsp; WEB DESIGN &nbsp;✦&nbsp; UX DESIGN &nbsp;✦&nbsp; SOCIAL MEDIA &nbsp;✦&nbsp; PHOTOGRAPHY &nbsp;✦&nbsp; DALLAS, TX &nbsp;✦&nbsp; BUILT FOR THE BOLD &nbsp;✦&nbsp;
              </span>
            ))}
          </div>
          <svg viewBox="0 0 1440 14" className={styles.aboutWave} preserveAspectRatio="none">
            <path d="M0,0 L1440,0 L1440,7 C1418,1 1395,3.5 1350,7 C1260,14 1170,0 1080,7 C990,14 900,0 810,7 C720,14 630,0 540,7 C450,14 360,0 270,7 C180,14 90,0 0,7 Z" fill="#0a0a0a"/>
            <path d="M0,7 C90,0 180,14 270,7 C360,0 450,14 540,7 C630,0 720,14 810,7 C900,0 990,14 1080,7 C1170,0 1260,14 1350,7 C1395,3.5 1418,1 1440,7" fill="none" stroke="#e50586" strokeWidth="2.5"/>
          </svg>
        </div>

        {/* floating badges */}
        <div className={`${styles.afBadge} ${styles.afb1}`}>BOLD<br/>BY DESIGN</div>
        <div className={`${styles.afBadge} ${styles.afb2}`}>DALLAS<br/>TX</div>
        <div className={`${styles.afBadge} ${styles.afb3}`}>BLACK<br/>OWNED</div>
        <div className={`${styles.afBadge} ${styles.afb4}`}>FULL<br/>SERVICE</div>

        <div className={`${styles.aboutTextWrap} reveal d2`}>
          <h2 className={styles.aboutH}>We do <em>almost</em> <u>everything</u></h2>
          <p className={styles.aboutP}>Thrive Creative Studios is a full-service creative agency rooted in representation. We exist because Black creatives — especially Black women — have always been forces in the creative world, but not always given the seat, the stage, or the spotlight they deserve. So we built the room ourselves.</p>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className={styles.services} id="services">

        <div>
          <h2 className={`${styles.servicesTitle} reveal`}><em>Take a peek at</em><br />OUR SERVICES</h2>
          <p className={`${styles.servicesDesc} reveal`} style={{ transitionDelay: "0.1s" }}>Whether you need a quick turnaround brand identity or the whole dream creative experience, I&apos;ll build you something that&apos;s bold, strategic, and fun to show off. Your brand won&apos;t just look good — it&apos;ll get you booked.</p>
        </div>

        <div className={styles.svcLayout}>
        <div className={styles.svcTabs} role="tablist">
          {["DIGITAL DESIGN", "SOCIAL MEDIA", "UX DESIGN", "BRAND DESIGN", "PHOTOGRAPHY"].map((label, i) => (
            <div
              key={i}
              className={`${styles.svcTab} ${activeTab === i ? styles.svcTabActive : ""}`}
              style={{ animationDelay: `${i * 0.07}s` }}
              data-idx={i}
              role="tab"
              tabIndex={0}
              onClick={() => setActiveTab(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(i); }}
            >
              <span className={styles.svcTabLabel}>{label}</span>
            </div>
          ))}
        </div>

        <div className={styles.svcPanelWrap}>
          {SERVICES.map((svc, i) => (
            <div
              key={i}
              className={`${styles.svcPanel} ${activeTab === i ? styles.svcPanelActive : ""}`}
              data-panel={i}
              role="tabpanel"
            >
              <div className={styles.svcPanelLeft}>
                <div>
                  <div className={styles.svcPanelTag}>{svc.tag}</div>
                  <div className={styles.svcPanelName}>{svc.name}</div>
                  <div className={styles.svcPanelSub}>{svc.sub}</div>
                  <p className={styles.svcPanelDesc}>{svc.desc}</p>
                </div>
                <a href={svc.href} className={styles.svcPanelBtn}>GIMME THE DETAILS →</a>
              </div>
              <div className={styles.svcPanelRight}>
                {svc.media.type === "video" ? (
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  >
                    <source src={storageUrl(`videos/${svc.media.src}`)} type="video/mp4" />
                  </video>
                ) : (
                  <img
                    src={svc.media.local ? svc.media.src : storageUrl(svc.media.src)}
                    alt={svc.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        </div>

      </section>

      {/* ── PROCESS ── */}
      <section className={styles.process} id="process">
        <div className={`${styles.processCards} reveal`}>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>01</div>
            <p className={styles.pcardText}>We start by listening. Deep dives into your brand, your audience, your goals — and the story only you can tell.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>02</div>
            <p className={styles.pcardText}>Strategy first. We build a creative brief and direction that becomes the north star for every decision we make.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>03</div>
            <p className={styles.pcardText}>This is where we create. Bold concepts, refined execution, and relentless attention to every detail.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>04</div>
            <p className={styles.pcardText}>Launch-ready deliverables — and ongoing partnership to keep your brand growing long after handoff.</p>
          </div>
        </div>
        <div className={`${styles.processGhost} reveal`} data-px="-0.4">THE PROCESS</div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={styles.testimonials} id="testimonials">
        <div className={styles.testiCircles}>
          <div className={`${styles.tcircle} ${styles.tc1} reveal d1`}>
            <p className={styles.tcircleText}>Thrive completely transformed how our brand shows up. The energy, the vision, the execution — nothing short of exceptional.</p>
            <span className={styles.tcircleClient}>DJ Mastamind</span>
          </div>
          <div className={`${styles.tcircle} ${styles.tc2} reveal d2`}>
            <p className={styles.tcircleText}>Working with Thrive felt like working with people who actually understood our community.</p>
            <span className={styles.tcircleClient}>Classic Rollers</span>
          </div>
          <div className={`${styles.tcircle} ${styles.tc3} reveal d3`}>
            <p className={styles.tcircleText}>The work they did set us apart immediately. Bold, intentional, and exactly right.</p>
            <span className={styles.tcircleClient}>The Burrell Group</span>
          </div>
        </div>
        <div className={`${styles.testiGhost} reveal`} data-px="0.4">OUR CLIENTS SAY</div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className={styles.ctaBanner}>
        <span className={styles.ctaBannerText}>Ready to build with us?</span>
        <a href="/contact" className={styles.ctaBannerBtn}>LET&apos;S TALK →</a>
      </section>

    </div>
    </PublicLayout>
  );
}
