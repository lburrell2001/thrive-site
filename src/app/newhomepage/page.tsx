"use client";

import { useEffect } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import styles from "./newhomepage.module.css";
import PublicLayout from "../components/PublicLayout";
import WorkReel from "../components/WorkReel";
import { storageUrl } from "@/lib/storage";
import { HomeIntro, HomeOutro } from "./HomeSections";

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
    tag: "01 — Web", name: "WEB DEVELOPMENT", sub: "TIMELINE SCOPED TO YOUR PROJECT",
    desc: "Custom-coded websites built from scratch for your business — designed in your colors and fonts, not a template.",
    href: "/services/digital-design",
    media: { type: "image" as const, src: "/new-thrive/services/web-development.webp", local: true },
  },
  {
    tag: "02 — Social", name: "SOCIAL MEDIA", sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "Content editing and consistent posting: designed posts, edited videos and captions, scheduled and posted every month.",
    href: "/services/social-media",
    media: { type: "video" as const, src: "hero-social.mp4", poster: "/new-thrive/services/social-media.webp" },
  },
  {
    tag: "03 — UX", name: "UX DESIGN", sub: "EXPERIENCES PEOPLE ACTUALLY LOVE",
    desc: "Human-centered product design that makes digital experiences feel effortless and intuitive — from wireframes to polished prototypes.",
    href: "/services/ux-design",
    media: { type: "video" as const, src: "ux-hero.mp4", poster: "/new-thrive/services/ux.webp" },
  },
  {
    tag: "04 — Brand", name: "BRAND DESIGN", sub: "ALL YOURS IN ONLY 4–6 WEEKS",
    desc: "Complete visual identities — logos, color systems, typography, and brand guidelines — built from the ground up to set you apart in your industry.",
    href: "/services/brand-design",
    media: { type: "video" as const, src: "thrive-hero-v2.mp4", poster: "/new-thrive/services/brand-design.webp" },
  },
  {
    tag: "05 — Photo", name: "PHOTOGRAPHY", sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Brand photography and visual storytelling that captures real culture, real beauty, and real depth — bold, intentional, unforgettable.",
    href: "/services/photography",
    media: { type: "image" as const, src: "/new-thrive/services/photo.webp", local: true },
  },
];

// Mobile hero: each service is a round photo sticker scattered around the logo.
type Patch = { name: string; href: string; img: string; tone: string; spot: string };

const HERO_PATCHES: Patch[] = [
  { name: "Web Development", href: "/services/digital-design", img: "/new-thrive/services/web-development.webp", tone: "patchPink",   spot: "spotWeb" },
  { name: "Social Media",    href: "/services/social-media",   img: "/new-thrive/services/social-media.webp",    tone: "patchGreen",  spot: "spotSocial" },
  { name: "UX Design",       href: "/services/ux-design",      img: "/new-thrive/services/ux.webp",              tone: "patchOrange", spot: "spotUx" },
  { name: "Brand Design",    href: "/services/brand-design",   img: "/new-thrive/services/brand-design.webp",    tone: "patchBlue",   spot: "spotBrand" },
  { name: "Photography",     href: "/services/photography",    img: "/new-thrive/services/photo.webp",           tone: "patchBlack",  spot: "spotPhoto" },
];

// The full name runs round a colour ring, repeated twice with stars between.
const RING_R = 41.5;
const RING_LEN = 2 * Math.PI * RING_R;

function PatchRing({ name, id }: { name: string; id: string }) {
  const text = `${name.toUpperCase()} ✦ `.repeat(2);
  const size = Math.min(9.5, RING_LEN / (text.length * 0.8));
  return (
    <svg viewBox="0 0 100 100" className={styles.patchRing} aria-hidden>
      <defs>
        <path id={id} d={`M${50 - RING_R},50 a${RING_R},${RING_R} 0 1,1 ${RING_R * 2},0 a${RING_R},${RING_R} 0 1,1 ${-RING_R * 2},0`} />
      </defs>
      <circle cx={50} cy={50} r={RING_R} className={styles.patchRingBand} />
      <circle cx={50} cy={50} r={RING_R - 8.5} className={styles.patchRingEdge} />
      <text className={styles.patchRingText} fontSize={size} dominantBaseline="central">
        <textPath href={`#${id}`} textLength={RING_LEN - 2} lengthAdjust="spacing">{text}</textPath>
      </text>
    </svg>
  );
}

function PatchLinks({ patches }: { patches: Patch[] }) {
  return patches.map((p) => (
    <a key={p.href} href={p.href} aria-label={p.name} className={`${styles.patch} ${styles[p.tone]} ${styles[p.spot]}`}>
      <span className={styles.patchArt}>
        <img src={p.img} alt="" className={styles.patchImg} />
        <PatchRing name={p.name} id={`ring-${p.spot}`} />
      </span>
    </a>
  ));
}

export default function NewHomePage() {
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
          <p className={styles.heroKicker}>Full-service creative agency · Dallas, TX</p>
        </div>

        {/* Mobile only: a full-screen hero with the services scattered around the logo as patches */}
        <nav className={styles.heroPatches} aria-label="Services">
          <PatchLinks patches={HERO_PATCHES} />
        </nav>
        <a href="/contact" className={styles.heroCta}>LET&apos;S TALK →</a>
      </section>

      <HomeIntro services={SERVICES} />

      {/* ── WORK REEL ── */}
      <WorkReel eyebrow="Fresh from the studio" title="Work we're proud of" tone="dark" />

      <HomeOutro />

    </div>
    </PublicLayout>
  );
}
