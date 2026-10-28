import type { Metadata } from "next";
import Link from "next/link";
import PublicLayout from "../../components/PublicLayout";
import PhotoStrip from "../../components/PhotoStrip";
import { WORK_PHOTOS } from "@/lib/workPhotos";
import { storageUrl } from "@/lib/storage";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import ServiceFaq from "../../components/ServiceFaq";
import ServicePricing from "../../components/ServicePricing";
import ServiceAbout from "../../components/ServiceAbout";
import ServiceTestimonials from "../../components/ServiceTestimonials";

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["brand-design"].title,
  description: SERVICE_SEO["brand-design"].description,
  path: "/services/brand-design",
  keywords: [
    "brand design Dallas TX",
    "logo design Texas",
    "visual identity design",
    "brand guidelines",
    "brand kit studio",
  ],
});

export const dynamic = 'force-dynamic';

const ACCENT = "#fd6100";
const ACCENT_TEXT = "#000";

const DELIVERABLES = [
  { title: "Logo Design", desc: "A primary mark and lockup variations built to work everywhere — digital, print, and beyond." },
  { title: "Color System", desc: "A full palette with hex codes and usage rules that make your brand recognizable at a glance." },
  { title: "Typography", desc: "Font pairing and hierarchy that makes every headline and caption feel intentional." },
  { title: "Brand Guidelines", desc: "A living doc covering logo usage, colors, typography, do's and don'ts." },
  { title: "Social & Print Pieces", desc: "Social media profile and cover images and a business card design, with a full identity." },
  { title: "Final Files", desc: "Every final file packaged and delivered for print and web." },
];

const PROCESS = [
  { step: "01", title: "Discovery", desc: "Quick call + vibe alignment. We lock goals, scope, and the look we're chasing." },
  { step: "02", title: "Concepts", desc: "Two logo concepts so you can choose the one that feels most like you." },
  { step: "03", title: "Refinement", desc: "We polish the system: spacing, type, color — everything gets tight." },
  { step: "04", title: "Delivery", desc: "Final exports + brand guidelines. Clean files, clear instructions." },
];

export default function BrandDesignPage() {

  return (
    <PublicLayout>
      <div>
        <style>{`
          .sp-page { background: #fff; color: #0a0a0a; }

          /* ── HERO ── */
          .sp-hero {
            position: relative;
            min-height: 600px;
            display: flex;
            align-items: flex-end;
            background: #0a0a0a;
            background-size: cover;
            background-position: center;
            overflow: hidden;
          }
          .sp-hero-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.80) 55%, rgba(0,0,0,0.55) 100%);
            z-index: 0;
          }
          .sp-hero-left {
            position: relative;
            z-index: 1;
            padding: 130px 96px;
            max-width: 680px;
            display: flex;
            flex-direction: column;
            gap: 52px;
            box-sizing: border-box;
          }
          .sp-hero-h1 {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(35px, 4.8vw, 58px);
            letter-spacing: -0.04em;
            line-height: 1;
            color: #fff;
            margin: 0;
          }
          .sp-hero-sub {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin: 0 0 12px;
          }
          .sp-hero-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 16px;
            line-height: 1.7;
            color: rgba(255,255,255,0.75);
            margin: 0;
            max-width: 420px;
          }
          .sp-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
          .sp-btn-primary {
            display: inline-block;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            transition: opacity .15s;
          }
          .sp-btn-primary:hover { opacity: 0.85; }
          .sp-btn-secondary {
            display: inline-block;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            background: transparent;
            color: #fff;
            border: 2px solid rgba(255,255,255,0.5);
            transition: border-color .15s, color .15s;
          }
          .sp-btn-secondary:hover { border-color: #fff; color: #fff; }

          /* ── DELIVERABLES ── */
          .sp-deliverables {
            background: #f5f4f2;
            padding: 130px 96px;
            box-sizing: border-box;
          }
          .sp-section-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(22px, 3.2vw, 42px);
            letter-spacing: -0.04em;
            line-height: 1.05;
            margin: 0 0 78px;
          }
          .sp-del-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 26px;
          }
          .sp-del-card {
            padding: 24px;
          }
          .sp-del-title {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 16px;
            letter-spacing: -0.01em;
            margin: 0 0 8px;
          }
          .sp-del-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            line-height: 1.6;
            color: #444;
            margin: 0;
          }

          /* ── PROCESS ── */
          .sp-process {
            background: #0a0a0a;
            padding: 130px 96px;
            box-sizing: border-box;
          }
          .sp-process .sp-section-heading { color: #fff; }
          .sp-process-steps {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 31px;
          }
          .sp-step { border-top: 2px solid #222; padding-top: 20px; }
          .sp-step-num {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 32px;
            letter-spacing: -0.04em;
            line-height: 1;
            margin-bottom: 12px;
          }
          .sp-step-title {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 18px;
            letter-spacing: -0.02em;
            color: #fff;
            margin: 0 0 10px;
          }
          .sp-step-desc {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            line-height: 1.7;
            color: #666;
            margin: 0;
          }

          /* ── FEATURED ── */

          /* ── CTA ── */
          .sp-cta {
            padding: 162px 96px;
            box-sizing: border-box;
            text-align: center;
          }
          .sp-cta-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(26px, 4vw, 48px);
            letter-spacing: -0.04em;
            line-height: 1.05;
            margin: 0 0 16px;
          }
          .sp-cta-sub {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 16px;
            line-height: 1.7;
            margin: 0 auto 36px;
            max-width: 480px;
          }

          /* ── TABLET ── */
          @media (max-width: 960px) {
            .sp-hero-left { padding: 98px 58px; max-width: 100%; }
            .sp-deliverables,
            .sp-process,
            .sp-cta { padding: 130px 58px; }
            .sp-del-grid { grid-template-columns: repeat(2, 1fr); }
            .sp-process-steps { grid-template-columns: repeat(2, 1fr); }
          }

          /* ── MOBILE ── */
          @media (max-width: 767px) {
            .sp-hero { min-height: 480px; align-items: flex-end; }
            .sp-hero-left { padding: 78px 24px; gap: 42px; max-width: 100%; }
            .sp-deliverables,
            .sp-process,
            .sp-cta { padding: 117px 24px; }
            .sp-del-grid { grid-template-columns: 1fr; }
            .sp-process-steps { grid-template-columns: 1fr 1fr; }
          }
          @media (max-width: 480px) {
            .sp-process-steps { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="sp-page">
          {/* HERO */}
          <section className="sp-hero" style={{ backgroundImage: `url('${storageUrl("services/brand-design-cover.jpg")}'), url('/new-thrive/services/brand-design.webp')` }}>
            <div className="sp-hero-overlay" />
            <div className="sp-hero-left">
              <div>
                <h1 className="sp-hero-h1">BRAND<br />DESIGN</h1>
              </div>
              <div>
                <p className="sp-hero-sub" style={{ color: ACCENT }}>ALL YOURS IN ONLY 4–6 WEEKS</p>
                <p className="sp-hero-desc">
                  Complete visual identities — logos, color systems, typography, and brand
                  guidelines — built from the ground up to set you apart.
                </p>
              </div>
              <div className="sp-hero-actions">
                <a href="/contact" className="sp-btn-primary" style={{ background: ACCENT, color: ACCENT_TEXT }}>
                  START YOUR PROJECT →
                </a>
                <a href="/services" className="sp-btn-secondary">← ALL SERVICES</a>
              </div>
            </div>
          </section>

          {/* DELIVERABLES */}
          <ServiceAbout slug="brand-design" accent={ACCENT} />

          <section className="sp-deliverables">
            <h2 className="sp-section-heading">EVERYTHING YOUR<br />BRAND NEEDS</h2>
            <div className="sp-del-grid">
              {DELIVERABLES.map((d, i) => (
                <div key={i} className="sticker-card sp-del-card">
                  <h3 className="sp-del-title">{d.title}</h3>
                  <p className="sp-del-desc">{d.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <PhotoStrip photos={WORK_PHOTOS["brand-design"]} title="Brands we’ve built" />
          <p style={{ margin: "-40px auto 0", padding: "0 20px 56px", maxWidth: 1200, boxSizing: "border-box", fontSize: 16, lineHeight: 1.6, color: "#444" }}>
            We also work with businesses in Amarillo, our founder&apos;s hometown. Take a look at <Link style={{ color: "#0a0a0a", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }} href="/amarillo-web-design">our Amarillo work</Link>.
          </p>

          {/* PROCESS */}
          <section className="sp-process">
            <h2 className="sp-section-heading">HOW WE BUILD IT</h2>
            <div className="sp-process-steps">
              {PROCESS.map((s, i) => (
                <div key={i} className="sp-step">
                  <div className="sp-step-num" style={{ color: ACCENT }}>{s.step}</div>
                  <p className="sp-step-title">{s.title}</p>
                  <p className="sp-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FEATURED WORK */}
          <ServicePricing slug="brand-design" accent={ACCENT} accentText={ACCENT_TEXT} />



          <ServiceTestimonials slug="brand-design" accent={ACCENT} />

          {/* FAQ */}
          <ServiceFaq slug="brand-design" accent={ACCENT} />

          {/* CTA */}
          <section className="sp-cta" style={{ background: ACCENT }}>
            <h2 className="sp-cta-heading" style={{ color: ACCENT_TEXT }}>READY TO BUILD<br />YOUR BRAND?</h2>
            <p className="sp-cta-sub" style={{ color: "rgba(0,0,0,0.6)" }}>
              Let&apos;s make something bold. Reach out and we&apos;ll figure out the perfect package for where you are right now.
            </p>
            <a href="/contact" className="sp-btn-primary" style={{ background: "#000", color: "#fff" }}>
              GET STARTED →
            </a>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
