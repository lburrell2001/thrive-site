"use client";

import { useEffect } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import styles from "./newhomepage.module.css";
import PublicLayout from "../components/PublicLayout";
import WorkReel from "../components/WorkReel";
import { SHOWCASE } from "@/lib/serviceShowcase";
import PhotoSticker from "../components/PhotoSticker";
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

// Where each service's sticker sits in the hero (see .spot* in the CSS).
const SPOTS: Record<string, string> = {
  "digital-design": "spotWeb",
  "social-media": "spotSocial",
  "ux-design": "spotUx",
  "brand-design": "spotBrand",
  photography: "spotPhoto",
};

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
          {SHOWCASE.map((svc) => (
            <a key={svc.href} href={svc.href} aria-label={svc.title} className={`${styles.patch} ${styles[SPOTS[svc.slug]]}`}>
              <PhotoSticker name={svc.title} img={svc.sticker} tone={svc.tone} id={`ring-${svc.slug}`} />
            </a>
          ))}
        </nav>
        <a href="/contact" className={styles.heroCta}>LET&apos;S TALK →</a>
      </section>

      <HomeIntro services={SHOWCASE} />

      {/* ── WORK REEL ── */}
      <WorkReel title="Work we're proud of" tone="dark" />

      <HomeOutro />

    </div>
    </PublicLayout>
  );
}
