"use client";

import { useState } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
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
    tag: "01 — Digital",
    name: "DIGITAL DESIGN",
    sub: "ALL YOURS IN ONLY 2–4 WEEKS",
    desc: "Web design, landing pages, and digital assets built from the ground up — infused with strategy and a visual identity that sets you apart.",
    color: "#1e3add",
    textColor: "#fff",
    href: "/services/digital-design",
    img: storageUrl("services/digital-design-cover.jpg"),
    fallback: "/new-thrive/services/digital-design.jpg",
  },
  {
    tag: "02 — Social",
    name: "SOCIAL MEDIA",
    sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "Strategy, content creation, and community management that grows your audience and turns followers into loyal clients.",
    color: "#e50586",
    textColor: "#fff",
    href: "/services/social-media",
    img: storageUrl("services/social-media-cover.jpg"),
    fallback: "/new-thrive/services/social-media.png",
  },
  {
    tag: "03 — UX",
    name: "UX DESIGN",
    sub: "EXPERIENCES PEOPLE ACTUALLY LOVE",
    desc: "Human-centered product design that makes digital experiences feel effortless and intuitive — from wireframes to polished prototypes.",
    color: "#5b2d8e",
    textColor: "#fff",
    href: "/services/ux-design",
    img: storageUrl("services/ux-design-cover.jpg"),
    fallback: "/new-thrive/services/ux.png",
  },
  {
    tag: "04 — Brand",
    name: "BRAND DESIGN",
    sub: "ALL YOURS IN ONLY 4–6 WEEKS",
    desc: "Complete visual identities — logos, color systems, typography, and brand guidelines — built from the ground up to set you apart.",
    color: "#fd6100",
    textColor: "#000",
    href: "/services/brand-design",
    img: storageUrl("services/brand-design-cover.jpg"),
    fallback: "/new-thrive/services/brand-design.jpg",
  },
  {
    tag: "05 — Photo",
    name: "PHOTOGRAPHY",
    sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Brand photography and visual storytelling that captures real culture, real beauty, and real depth — bold, intentional, unforgettable.",
    color: "#0cf574",
    textColor: "#000",
    href: "/services/photography",
    img: storageUrl("services/photography-cover.jpg"),
    fallback: "/new-thrive/services/photo.png",
  },
];

const TAB_LABELS = ["DIGITAL DESIGN", "SOCIAL MEDIA", "UX DESIGN", "BRAND DESIGN", "PHOTOGRAPHY"];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable}`}>
        <style>{`
          .sv-page {
            background: #fff;
            color: #0a0a0a;
          }

          /* ── HERO ── */
          .sv-hero {
            position: relative;
            padding: 80px 80px 40px;
            box-sizing: border-box;
            overflow: hidden;
          }
          .sv-ghost {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(100px, 14vw, 200px);
            color: rgba(0,0,0,.05);
            position: absolute;
            top: 20px;
            left: 0;
            z-index: 0;
            pointer-events: none;
            line-height: 1;
            white-space: nowrap;
            user-select: none;
          }
          .sv-eyebrow {
            position: relative;
            z-index: 1;
            display: inline-block;
            background: #0a0a0a;
            color: #fff;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            letter-spacing: 2px;
            padding: 8px 16px;
            border-radius: 6px;
            margin-bottom: 24px;
            text-transform: uppercase;
          }
          .sv-h1 {
            position: relative;
            z-index: 1;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(40px, 6vw, 60px);
            letter-spacing: -0.04em;
            line-height: 1;
            margin: 0 0 20px;
          }
          .sv-subtitle {
            position: relative;
            z-index: 1;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 17px;
            line-height: 1.7;
            color: #444;
            max-width: 600px;
            margin: 0;
          }

          /* ── TABS ── */
          .sv-layout { display: flex; flex-direction: column; }
          .sv-tabs-wrap {
            padding: 40px 80px 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            gap: 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .sv-tabs-wrap::-webkit-scrollbar { height: 0; }
          .sv-tab {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            padding: 10px 24px;
            border-radius: 10px 10px 0 0;
            border: 2px solid #000;
            border-bottom: none;
            cursor: pointer;
            background: #efefef;
            color: #808080;
            position: relative;
            bottom: -2px;
            white-space: nowrap;
            transition: background .15s, color .15s;
            user-select: none;
          }
          .sv-tab + .sv-tab { margin-left: -2px; }
          .sv-tab-active {
            bottom: 0;
            color: #000;
            z-index: 2;
          }
          .sv-tab-active-0 { background: #1e3add; color: #fff; }
          .sv-tab-active-1 { background: #e50586; color: #fff; }
          .sv-tab-active-2 { background: #5b2d8e; color: #fff; }
          .sv-tab-active-3 { background: #fd6100; color: #000; }
          .sv-tab-active-4 { background: #0cf574; color: #000; }

          /* ── PANEL ── */
          .sv-panel-wrap {
            margin: 0 80px;
            border: 2px solid #000;
            border-radius: 0 12px 12px 12px;
            overflow: hidden;
            box-sizing: border-box;
          }
          .sv-panel {
            display: none;
            grid-template-columns: 1fr 1fr;
          }
          .sv-panel-visible {
            display: grid;
          }
          .sv-panel-left {
            padding: 48px 52px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 32px;
          }
          .sv-panel-tag {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            letter-spacing: 2px;
            color: #808080;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          .sv-panel-name {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(28px, 4vw, 48px);
            letter-spacing: -0.03em;
            line-height: 1;
            margin-bottom: 10px;
          }
          .sv-panel-sub {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 12px;
            letter-spacing: 2px;
            color: #808080;
            text-transform: uppercase;
            margin-bottom: 20px;
          }
          .sv-panel-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 15px;
            line-height: 1.8;
            color: #444;
            margin: 0 0 32px;
          }
          .sv-panel-btn {
            display: inline-block;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            padding: 10px 24px;
            border: 2px solid #000;
            border-radius: 6px;
            text-decoration: none;
            color: #000;
            background: #fff;
            transition: background .15s, color .15s;
            cursor: pointer;
            align-self: flex-start;
          }
          .sv-panel-btn:hover { background: #000; color: #fff; }
          .sv-panel-right {
            min-height: 380px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .sv-panel-right-label {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 12px;
            letter-spacing: 2px;
            color: rgba(255,255,255,0.7);
            text-transform: uppercase;
          }

          /* ── VIEW ALL ── */
          .sv-viewall {
            padding: 44px 80px 0;
            display: flex;
            gap: 32px;
            flex-wrap: wrap;
            box-sizing: border-box;
          }
          .sv-viewall a {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 24px;
            letter-spacing: -0.02em;
            color: #0a0a0a;
            text-decoration: underline;
            font-style: italic;
          }
          .sv-viewall a:hover { opacity: 0.7; }

          /* ── WHY THRIVE ── */
          .sv-why {
            background: #f5f4f2;
            padding: 80px;
            box-sizing: border-box;
            margin-top: 80px;
          }
          .sv-why-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(36px, 5vw, 60px);
            letter-spacing: -0.04em;
            margin: 0 0 48px;
          }
          .sv-why-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          .sv-why-card {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
          }
          .sv-why-card-bar {
            height: 4px;
          }
          .sv-why-card-body {
            padding: 24px;
          }
          .sv-why-card-title {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 20px;
            letter-spacing: -0.02em;
            margin: 0 0 12px;
          }
          .sv-why-card-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            line-height: 1.7;
            color: #808080;
            margin: 0;
          }

          /* ── TABLET ── */
          @media (max-width: 960px) {
            .sv-hero { padding: 60px 48px 32px; }
            .sv-tabs-wrap { padding: 32px 48px 0; }
            .sv-panel-wrap { margin: 0 48px; }
            .sv-panel-left { padding: 40px 40px; }
            .sv-viewall { padding: 36px 48px 0; }
            .sv-why { padding: 60px 48px; margin-top: 60px; }
            .sv-why-grid { grid-template-columns: repeat(2, 1fr); }
          }

          /* ── MOBILE ── */
          @media (max-width: 767px) {
            .sv-hero { padding: 60px 24px 32px; }
            .sv-ghost { display: none; }
            .sv-layout { flex-direction: row; align-items: stretch; margin: 0 24px; }
            .sv-tabs-wrap {
              flex-direction: column;
              padding: 0;
              overflow-x: visible;
              flex-shrink: 0;
            }
            .sv-tab {
              font-size: 11px;
              padding: 0;
              min-height: unset;
              height: 110px;
              width: 32px;
              min-width: unset;
              flex-shrink: 0;
              overflow: visible;
              writing-mode: unset;
              text-orientation: unset;
              border: 2px solid #000; border-right: none; border-bottom: none;
              border-radius: 10px 0 0 0;
              bottom: 0; right: -2px;
              margin-left: 0;
              z-index: 2;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sv-tab-label {
              display: block;
              white-space: nowrap;
              transform: rotate(-90deg);
            }
            .sv-tab::before { content: none; }
            .sv-tab + .sv-tab { border-radius: 0; margin-left: 0; }
            .sv-tab:last-child { border-bottom: 2px solid #000; border-radius: 0 0 0 10px; }
            .sv-tab-active { bottom: 0; z-index: 5; }
            .sv-panel-wrap { margin: 0; border-radius: 0 12px 12px 12px; flex: 1; }
            .sv-panel-visible { grid-template-columns: 1fr; }
            .sv-panel-right { min-height: 220px; }
            .sv-viewall { padding: 36px 24px 0; }
            .sv-why { padding: 60px 24px; margin-top: 60px; }
            .sv-why-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="sv-page">

          {/* ── HERO ── */}
          <section className="sv-hero">
            <span className="sv-ghost">SERVICES</span>
            
            <h1 className="sv-h1">We do <em>almost</em> <u>everything</u></h1>
            <p className="sv-subtitle">
              Whether you need a quick turnaround brand identity or the whole dream creative experience,
              I&apos;ll build you something bold, strategic, and fun to show off.
            </p>
          </section>

          {/* ── TABS + PANEL ── */}
          <div className="sv-layout">
          <div className="sv-tabs-wrap" role="tablist">
            {TAB_LABELS.map((label, i) => (
              <button
                key={i}
                className={`sv-tab${activeTab === i ? ` sv-tab-active sv-tab-active-${i}` : ""}`}
                role="tab"
                aria-selected={activeTab === i}
                onClick={() => setActiveTab(i)}
              >
                <span className="sv-tab-label">{label}</span>
              </button>
            ))}
          </div>

          {/* ── PANEL ── */}
          <div className="sv-panel-wrap">
            {SERVICES.map((svc, i) => (
              <div
                key={i}
                className={`sv-panel${activeTab === i ? " sv-panel-visible" : ""}`}
                role="tabpanel"
              >
                <div className="sv-panel-left">
                  <div>
                    <div className="sv-panel-tag">{svc.tag}</div>
                    <div className="sv-panel-name">{svc.name}</div>
                    <div className="sv-panel-sub">{svc.sub}</div>
                    <p className="sv-panel-desc">{svc.desc}</p>
                  </div>
                  <a href={svc.href} className="sv-panel-btn">LEARN MORE →</a>
                </div>
                <div className="sv-panel-right" style={{ overflow: "hidden" }}>
                  <img
                    src={svc.img}
                    alt={svc.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (img.src !== svc.fallback) img.src = svc.fallback;
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          </div>

          {/* ── VIEW ALL ── */}
          <div className="sv-viewall">
            
            <a href="/portfolio">View all work</a>
          </div>

          {/* ── WHY THRIVE ── */}
          <section className="sv-why">
            <h2 className="sv-why-heading">WHY THRIVE?</h2>
            <div className="sv-why-grid">
              <div className="sv-why-card">
                <div className="sv-why-card-bar" style={{ background: "#e50586" }} />
                <div className="sv-why-card-body">
                  <h3 className="sv-why-card-title">Rooted in Representation</h3>
                  <p className="sv-why-card-desc">
                    We build brands that reflect the full richness of culture — not just what&apos;s easy or expected.
                  </p>
                </div>
              </div>
              <div className="sv-why-card">
                <div className="sv-why-card-bar" style={{ background: "#fd6100" }} />
                <div className="sv-why-card-body">
                  <h3 className="sv-why-card-title">Strategy First</h3>
                  <p className="sv-why-card-desc">
                    Every visual decision is backed by real brand strategy — no guessing, no generic templates.
                  </p>
                </div>
              </div>
              <div className="sv-why-card">
                <div className="sv-why-card-bar" style={{ background: "#0cf574" }} />
                <div className="sv-why-card-body">
                  <h3 className="sv-why-card-title">Full-Service Studio</h3>
                  <p className="sv-why-card-desc">
                    From logo to launch — branding, web, social, photography, all under one roof.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
