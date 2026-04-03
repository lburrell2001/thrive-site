"use client";

import { Bungee, Bai_Jamjuree } from "next/font/google";
import PublicLayout from "../components/PublicLayout";

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

const STATS = [
  { num: "100%", label: "Black-Owned & Led", color: "#e50586" },
  { num: "5+", label: "Core Services", color: "#fd6100" },
  { num: "Open", label: "Taking Clients", color: "#0cf574" },
  { num: "Dallas", label: "Based In TX", color: "#1e3add" },
];

const VALUES = [
  {
    title: "Representation",
    color: "#e50586",
    desc: "We build for the underrepresented. Every project is a step toward an industry that finally looks as rich and diverse as the world we live in.",
  },
  {
    title: "Boldness",
    color: "#fd6100",
    desc: "We don't do safe. We do strategic, intentional, and unforgettable — work that makes people stop mid-scroll and actually pay attention.",
  },
  {
    title: "Excellence",
    color: "#0cf574",
    desc: "Good enough is never enough. We obsess over every detail — because your brand deserves nothing less than extraordinary.",
  },
  {
    title: "Community",
    color: "#5b2d8e",
    desc: "We're not just building brands — we're building with community. Everything we create is rooted in real connection and collective growth.",
  },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable}`}>
        <style>{`
          .ab-page {
            background: #fff;
            color: #0a0a0a;
          }

          /* ── HERO ── */
          .ab-hero {
            position: relative;
            padding: 80px 80px 64px;
            box-sizing: border-box;
            overflow: hidden;
          }
          .ab-hero-inner {
            max-width: 1200px;
            margin: 0 auto;
          }
          .ab-ghost {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(100px, 14vw, 200px);
            color: rgba(0,0,0,.05);
            position: absolute;
            top: 10px;
            left: 0;
            z-index: 0;
            pointer-events: none;
            line-height: 1;
            white-space: nowrap;
            user-select: none;
          }
          .ab-eyebrow {
            position: relative;
            z-index: 1;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #808080;
            margin-bottom: 32px;
            display: block;
          }
          .ab-hero-grid {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 48px;
            align-items: start;
          }
          .ab-h1 {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(36px, 5vw, 72px);
            letter-spacing: -0.04em;
            line-height: 1;
            margin: 0;
          }
          .ab-mission-card {
            background: #0a0a0a;
            border-radius: 12px;
            border-left: 6px solid #e50586;
            padding: 36px;
            box-sizing: border-box;
          }
          .ab-mission-label {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: rgba(255,255,255,.4);
            margin-bottom: 16px;
            display: block;
          }
          .ab-mission-text {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 15px;
            color: rgba(255,255,255,.8);
            line-height: 1.8;
            margin: 0;
          }

          /* ── STATS ── */
          .ab-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            padding: 0 80px 80px;
            box-sizing: border-box;
            max-width: 1360px;
            margin: 0 auto;
          }
          .ab-stat-card {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
            text-align: center;
          }
          .ab-stat-bar {
            height: 4px;
          }
          .ab-stat-body {
            padding: 24px 16px;
          }
          .ab-stat-num {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(36px, 5vw, 56px);
            letter-spacing: -0.03em;
            line-height: 1;
            margin: 0 0 8px;
          }
          .ab-stat-label {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 13px;
            color: #808080;
            margin: 0;
          }

          /* ── FOUNDER ── */
          .ab-founder {
            background: #f5f4f2;
            padding: 80px;
            box-sizing: border-box;
          }
          .ab-founder-inner {
            max-width: 1200px;
            margin: 0 auto;
          }
          .ab-founder-photo-wrap {
            position: relative;
            display: flex;
            flex-direction: column;
          }
          .ab-we-are-thrive {
            position: absolute;
            top: -28px;
            right: -28px;
            width: 140px; height: 140px;
            background: #5b2d8e;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            flex-direction: column;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 16px; letter-spacing: -0.02em;
            color: #fff; text-align: center; line-height: 1.15;
            transform: rotate(12deg);
            z-index: 10;
            box-shadow: 0 4px 20px rgba(91,45,142,.4);
          }
          .ab-we-are-thrive::before {
            content: ''; position: absolute; inset: 7px;
            border: 1px solid rgba(255,255,255,.25); border-radius: 50%;
          }
          .ab-founder-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 56px;
            align-items: stretch;
          }
          .ab-founder-photo-wrap {
            position: relative;
          }
          .ab-founder-photo {
            position: relative;
            flex: 1;
            min-height: 400px;
            border-radius: 12px;
            overflow: hidden;
          }
          .ab-founder-photo img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .ab-founder-label {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #e50586;
            margin-bottom: 12px;
            display: block;
          }
          .ab-founder-name {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(40px, 5vw, 64px);
            letter-spacing: -0.04em;
            line-height: 1;
            margin: 0 0 8px;
          }
          .ab-founder-title {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 18px;
            color: #e50586;
            margin: 0 0 24px;
          }
          .ab-founder-bio {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 15px;
            line-height: 1.8;
            color: #444;
            margin: 0;
          }

          /* ── VALUES ── */
          .ab-values {
            padding: 80px;
            box-sizing: border-box;
          }
          .ab-values-inner {
            max-width: 1200px;
            margin: 0 auto;
          }
          .ab-values-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(36px, 5vw, 60px);
            letter-spacing: -0.04em;
            margin: 0 0 48px;
          }
          .ab-values-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
          .ab-val-card {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
          }
          .ab-val-bar {
            height: 4px;
          }
          .ab-val-body {
            padding: 28px;
          }
          .ab-val-title {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 22px;
            letter-spacing: -0.02em;
            margin: 0 0 12px;
          }
          .ab-val-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            line-height: 1.7;
            color: #808080;
            margin: 0;
          }

          /* ── TABLET ── */
          @media (max-width: 960px) {
            .ab-hero { padding: 60px 48px 40px; }
            .ab-stats { padding: 0 48px 60px; grid-template-columns: repeat(2, 1fr); }
            .ab-founder { padding: 60px 48px; }
            .ab-values { padding: 60px 48px; }
            .ab-values-grid { grid-template-columns: 1fr; }
          }

          /* ── MOBILE ── */
          @media (max-width: 767px) {
            .ab-hero { padding: 60px 24px 40px; }
            .ab-ghost { display: none; }
            .ab-hero-grid { grid-template-columns: 1fr; gap: 28px; }
            .ab-stats {
              grid-template-columns: repeat(2, 1fr);
              padding: 0 24px 60px;
            }
            .ab-founder { padding: 60px 24px; }
            .ab-founder-grid { grid-template-columns: 1fr; gap: 32px; }
            .ab-values { padding: 60px 24px; }
            .ab-values-grid { grid-template-columns: 1fr; }
          }
          @media (max-width: 480px) {
            .ab-stats { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="ab-page">

          {/* ── HERO ── */}
          <section className="ab-hero">
            <span className="ab-ghost">THRIVE</span>
            <div className="ab-hero-inner">
            <span className="ab-eyebrow">ABOUT</span>
            <div className="ab-hero-grid">
              <h1 className="ab-h1">BUILT FOR THE ONES WHO WERE MISSING FROM THE ROOM.</h1>
              <div className="ab-mission-card">
                <span className="ab-mission-label">OUR MISSION</span>
                <p className="ab-mission-text">
                  Thrive exists because Black creatives — especially Black women — have always been
                  forces in the creative world, but not always given the seat, the stage, or the
                  spotlight they deserve. So we built the room ourselves. Every brand we touch is a
                  deliberate step toward an industry that finally looks as rich and diverse as the
                  world we live in.
                </p>
              </div>
            </div>
            </div>
          </section>

          {/* ── STATS ── */}
          <div className="ab-stats">
            {STATS.map((stat, i) => (
              <div key={i} className="ab-stat-card">
                <div className="ab-stat-bar" style={{ background: stat.color }} />
                <div className="ab-stat-body">
                  <div className="ab-stat-num">{stat.num}</div>
                  <p className="ab-stat-label">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── FOUNDER ── */}
          <section className="ab-founder">
            <div className="ab-founder-inner">
            <div className="ab-founder-grid">
              <div className="ab-founder-photo-wrap">
                <div className="ab-we-are-thrive">WE ARE<br />THRIVE</div>
                <div className="ab-founder-photo">
                  <img
                    src="/lauren-portrait.jpg"
                    alt="Lauren Burrell"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              </div>
              <div>
                <span className="ab-founder-label">MEET THE FOUNDER</span>
                <h2 className="ab-founder-name">Lauren Burrell</h2>
                <p className="ab-founder-title">Founder & Creative Director</p>
                <p className="ab-founder-bio">
                  I started Thrive because I looked around the creative industry and didn&apos;t see
                  enough people who looked like me leading the rooms that matter. So I built one.
                  Thrive is my proof — to every Black creative, every underrepresented founder, every
                  brand that&apos;s been told to play it safe — that bold, strategic, culturally rich
                  work isn&apos;t the exception. It&apos;s the standard.
                </p>
              </div>
            </div>
            </div>
          </section>

          {/* ── VALUES ── */}
          <section className="ab-values">
            <div className="ab-values-inner">
            <h2 className="ab-values-heading">OUR VALUES</h2>
            <div className="ab-values-grid">
              {VALUES.map((val, i) => (
                <div key={i} className="ab-val-card">
                  <div className="ab-val-bar" style={{ background: val.color }} />
                  <div className="ab-val-body">
                    <h3 className="ab-val-title">{val.title}</h3>
                    <p className="ab-val-desc">{val.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
