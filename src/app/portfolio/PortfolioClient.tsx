"use client";

import { useState } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import PublicLayout from "../components/PublicLayout";
import { storageUrl } from "@/lib/storage";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee", display: "swap" });
const baiJamjuree = Bai_Jamjuree({ weight: ["400", "600", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-bai", display: "swap" });

type Project = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  tagline: string | null;
};

const CATEGORIES = ["All", "Brand Design", "Digital Design", "UX Design", "Social Media", "Photography"];

function matchesFilter(category: string | null, filter: string): boolean {
  if (!category) return false;
  return category.split(',').map(s => s.trim()).includes(filter);
}

export default function PortfolioClient({ projects }: { projects: Project[] }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered =
    activeFilter === "All"
      ? projects
      : projects.filter((p) => matchesFilter(p.category, activeFilter));

  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable}`}>
        <style>{`
          .pf-page { background: #fff; color: #0a0a0a; }
          .pf-hero {
            position: relative;
            padding: 80px 80px 48px;
            box-sizing: border-box;
            overflow: hidden;
          }
          .pf-ghost {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(100px, 14vw, 200px);
            color: rgba(0,0,0,.05);
            position: absolute;
            top: 10px; left: 0; z-index: 0;
            pointer-events: none;
            line-height: 1;
            white-space: nowrap;
            user-select: none;
          }
          .pf-eyebrow {
            position: relative; z-index: 1;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #808080;
            margin-bottom: 16px;
            display: block;
          }
          .pf-h1 {
            position: relative; z-index: 1;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(48px, 7vw, 88px);
            letter-spacing: -0.04em;
            line-height: 1;
            margin: 0;
          }
          .pf-filters {
            padding: 0 80px 48px;
            display: flex; flex-wrap: wrap; gap: 10px;
            box-sizing: border-box;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .pf-filters::-webkit-scrollbar { height: 0; }
          .pf-pill {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 13px;
            padding: 8px 18px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            background: #f1f0ee;
            color: #808080;
            white-space: nowrap;
            transition: background .15s, color .15s, transform .12s;
          }
          .pf-pill:hover { transform: scale(1.04); }
          .pf-pill-active { background: #0a0a0a; color: #fff; }
          .pf-grid {
            padding: 0 80px 80px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            box-sizing: border-box;
          }
          .pf-card {
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
            transition: transform .2s, box-shadow .2s;
          }
          .pf-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.1);
          }
          .pf-card-img {
            height: 200px;
            position: relative;
            display: flex;
            align-items: flex-end;
            padding: 12px 16px;
            box-sizing: border-box;
          }
          .pf-card-cat {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #fff;
            position: relative; z-index: 1;
          }
          .pf-card-body { padding: 20px; }
          .pf-card-name {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 20px;
            letter-spacing: -0.02em;
            margin: 0 0 6px;
          }
          .pf-card-sub {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 13px;
            color: #808080;
            margin: 0 0 16px;
          }
          .pf-view-btn {
            display: inline-block;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 12px;
            background: #0a0a0a;
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            text-decoration: none;
            transition: opacity .15s;
          }
          .pf-view-btn:hover { opacity: 0.8; }
          .pf-empty {
            padding: 80px;
            text-align: center;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 20px;
            color: #ccc;
            grid-column: 1 / -1;
          }
          .pf-cta {
            background: #0a0a0a;
            padding: 40px 80px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
            flex-wrap: wrap;
            gap: 24px;
          }
          .pf-cta-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(20px, 2.5vw, 32px);
            color: #fff;
            letter-spacing: -0.02em;
            margin: 0;
          }
          .pf-cta-btn {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            background: #e50586;
            color: #fff;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            white-space: nowrap;
            transition: opacity .15s, transform .12s;
          }
          .pf-cta-btn:hover { opacity: 0.88; transform: scale(1.04); }
          @media (max-width: 960px) {
            .pf-hero { padding: 60px 48px 32px; }
            .pf-filters { padding: 0 48px 36px; }
            .pf-grid { grid-template-columns: repeat(2, 1fr); padding: 0 48px 60px; }
            .pf-cta { padding: 36px 48px; }
          }
          @media (max-width: 767px) {
            .pf-hero { padding: 60px 24px 32px; }
            .pf-ghost { display: none; }
            .pf-filters { padding: 0 24px 36px; flex-wrap: nowrap; }
            .pf-grid { grid-template-columns: 1fr; padding: 0 24px 60px; }
            .pf-cta { padding: 36px 24px; }
          }
        `}</style>

        <div className="pf-page">
          <section className="pf-hero">
            <span className="pf-ghost">WORK</span>
            <span className="pf-eyebrow">SELECTED WORK</span>
            <h1 className="pf-h1">CREATIVITY WITHOUT LIMITS.</h1>
          </section>

          <div className="pf-filters" role="group" aria-label="Filter projects">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`pf-pill${activeFilter === cat ? " pf-pill-active" : ""}`}
                onClick={() => setActiveFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="pf-grid">
            {filtered.length === 0 ? (
              <p className="pf-empty">No projects yet.</p>
            ) : filtered.map((project) => (
              <div key={project.id} className="pf-card">
                <div className="pf-card-img" style={{ background: "#0a0a0a", padding: 0, overflow: "hidden" }}>
                  <img
                    src={storageUrl(`work/${project.slug}-cover.jpg`)}
                    alt={project.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <span className="pf-card-cat" style={{ position: "absolute", bottom: 12, left: 16 }}>
                    {project.category}
                  </span>
                </div>
                <div className="pf-card-body">
                  <h2 className="pf-card-name">{project.title}</h2>
                  <p className="pf-card-sub">{project.tagline ?? project.category}</p>
                  <a href={`/work/${project.slug}`} className="pf-view-btn">VIEW PROJECT →</a>
                </div>
              </div>
            ))}
          </div>

          <div className="pf-cta">
            <h2 className="pf-cta-heading">READY TO START YOUR PROJECT?</h2>
            <a href="/contact" className="pf-cta-btn">LET&apos;S TALK →</a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
