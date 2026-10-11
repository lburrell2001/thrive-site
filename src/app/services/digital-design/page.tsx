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
  title: SERVICE_SEO["digital-design"].title,
  description: SERVICE_SEO["digital-design"].description,
  path: "/services/digital-design",
  keywords: [
    "web design Dallas TX",
    "affordable web design Dallas",
    "small business website design",
    "landing page design Texas",
    "digital design studio",
    "website design small business",
    "digital assets design",
  ],
});

export const dynamic = 'force-dynamic';

const ACCENT = "#1e3add";
const ACCENT_TEXT = "#fff";

const DELIVERABLES = [
  { title: "Custom-Coded Websites", desc: "Sites written from scratch for your business, built to do exactly what you need." },
  { title: "Care Plans", desc: "Hosting, security updates, backups and monthly edits after launch." },
  { title: "Landing Pages", desc: "Focused single pages that drive sign-ups, sales or inquiries." },
  { title: "Edit It Yourself", desc: "With Large and Custom sites, an admin area so your team can edit text and photos." },
  { title: "Forms, Analytics & SEO", desc: "Forms that reach the right inbox, visitor insights and search groundwork, built in." },
  { title: "Mobile-First Layouts", desc: "Every page designed for phones first and tested on phones and desktops." },
];

const PROCESS = [
  { step: "01", title: "Discovery", desc: "We align on goals, audience, the pages you need, and which package fits." },
  { step: "02", title: "Design", desc: "A page-by-page plan, then full visual design: color, type, imagery and layout." },
  { step: "03", title: "Build", desc: "Your site coded from scratch, in your colors and fonts." },
  { step: "04", title: "Launch", desc: "Tested on phones and desktops, then launched." },
];

export default function DigitalDesignPage() {
  return (
    <PublicLayout>
      <div>
        <style>{`
          .sp-page { background: #fff; color: #0a0a0a; }
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
            padding: 80px;
            max-width: 680px;
            display: flex;
            flex-direction: column;
            gap: 40px;
            box-sizing: border-box;
          }
          .sp-hero-h1 {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(44px, 6vw, 72px);
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
          .sp-deliverables { background: #f5f4f2; padding: 80px; box-sizing: border-box; }
          .sp-section-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(28px, 4vw, 52px);
            letter-spacing: -0.04em;
            line-height: 1.05;
            margin: 0 0 48px;
          }
          .sp-del-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
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
          .sp-process { background: #0a0a0a; padding: 80px; box-sizing: border-box; }
          .sp-process .sp-section-heading { color: #fff; }
          .sp-process-steps {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
          }
          .sp-step { border-top: 2px solid #222; padding-top: 20px; }
          .sp-step-num {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 40px;
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
          .sp-cta { padding: 100px 80px; box-sizing: border-box; text-align: center; }
          .sp-cta-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(32px, 5vw, 60px);
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
            .sp-hero-left { padding: 60px 48px; }
            .sp-deliverables,
            .sp-process,
            .sp-cta { padding: 80px 48px; }
            .sp-del-grid { grid-template-columns: repeat(2, 1fr); }
            .sp-process-steps { grid-template-columns: repeat(2, 1fr); }
          }

          @media (max-width: 767px) {
            .sp-hero { min-height: 480px; }
            .sp-hero-left { padding: 48px 24px; gap: 32px; }
            .sp-deliverables,
            .sp-process,
            .sp-cta { padding: 72px 24px; }
            .sp-del-grid { grid-template-columns: 1fr; }
            .sp-process-steps { grid-template-columns: 1fr 1fr; }
          }
          @media (max-width: 480px) {
            .sp-process-steps { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="sp-page">
          <section className="sp-hero" style={{ backgroundImage: `url('${storageUrl("services/digital-design-cover.jpg")}'), url('/new-thrive/services/web-development.webp')` }}>
            <div className="sp-hero-overlay" />
            <div className="sp-hero-left">
              <div>
                <h1 className="sp-hero-h1" style={{ fontSize: "clamp(40px, 3.9vw, 56px)" }}>WEB<br />DEVELOPMENT</h1>
              </div>
              <div>
                <p className="sp-hero-sub" style={{ color: ACCENT }}>TIMELINE SCOPED TO YOUR PROJECT</p>
                <p className="sp-hero-desc">
                  Custom-coded websites built from scratch for your business — designed in
                  your colors and fonts, not a template.
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

          <ServiceAbout slug="digital-design" accent={ACCENT} />

          <section className="sp-deliverables">
            <h2 className="sp-section-heading">CUSTOM-CODED,<br />NOT TEMPLATED</h2>
            <div className="sp-del-grid">
              {DELIVERABLES.map((d, i) => (
                <div key={i} className="sticker-card sp-del-card">
                  <h3 className="sp-del-title">{d.title}</h3>
                  <p className="sp-del-desc">{d.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <PhotoStrip photos={WORK_PHOTOS["digital-design"]} title="Sites we’ve built" />
          <p style={{ margin: "-40px auto 0", padding: "0 20px 56px", maxWidth: 1200, boxSizing: "border-box", fontSize: 16, lineHeight: 1.6, color: "#444" }}>
            We also work with businesses in Amarillo. See our <Link style={{ color: "#0a0a0a", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }} href="/amarillo-web-design">Amarillo web development</Link> page.
          </p>

          <section className="sp-process">
            <h2 className="sp-section-heading">FROM BRIEF<br />TO LIVE SITE</h2>
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

          <ServicePricing slug="digital-design" accent={ACCENT} accentText={ACCENT_TEXT} />



          <ServiceTestimonials slug="digital-design" accent={ACCENT} />

          {/* FAQ */}
          <ServiceFaq slug="digital-design" accent={ACCENT} />

          <section className="sp-cta" style={{ background: ACCENT }}>
            <h2 className="sp-cta-heading" style={{ color: ACCENT_TEXT }}>READY FOR A WEBSITE<br />THAT WORKS?</h2>
            <p className="sp-cta-sub" style={{ color: "rgba(255,255,255,0.7)" }}>
              Tell us what you&apos;re building and we&apos;ll recommend the package that fits your timeline and budget.
            </p>
            <a href="/contact" className="sp-btn-primary" style={{ background: "#fff", color: "#000" }}>
              GET STARTED →
            </a>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
