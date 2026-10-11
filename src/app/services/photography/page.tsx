import type { Metadata } from "next";
import PublicLayout from "../../components/PublicLayout";
import PhotoStrip from "../../components/PhotoStrip";
import { WORK_PHOTOS } from "@/lib/workPhotos";
import { storageUrl } from "@/lib/storage";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import ServiceFaq from "../../components/ServiceFaq";
import ServicePricing from "../../components/ServicePricing";
import ServiceTestimonials from "../../components/ServiceTestimonials";

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["photography"].title,
  description: SERVICE_SEO["photography"].description,
  path: "/services/photography",
  keywords: [
    "brand photography Dallas TX",
    "business photography Texas",
    "headshot photography studio",
    "product photography Dallas TX",
    "brand visual storytelling",
  ],
});

export const dynamic = 'force-dynamic';

const ACCENT = "#0cf574";
const ACCENT_TEXT = "#000";

const DELIVERABLES = [
  { title: "Brand Photography", desc: "Intentional images that show who you are — not just what you sell." },
  { title: "Headshots", desc: "Professional portraits that feel real, confident, and distinctly you." },
  { title: "Product Photography", desc: "Clean, editorial-style shots that make your products impossible to scroll past." },
  { title: "Event Coverage", desc: "Candid and composed shots of launches, pop-ups, and brand moments worth remembering." },
  { title: "Retouching & Editing", desc: "Every image is color-graded and retouched to match your brand aesthetic." },
  { title: "Licensed Deliverables", desc: "High-resolution files licensed for web, print, and social — ready to use anywhere." },
];

const PROCESS = [
  { step: "01", title: "Consultation", desc: "We talk about your brand, the feel you want, and what we need to capture." },
  { step: "02", title: "Shot List", desc: "A clear plan for every shot — no wasted time, no wondering what comes next." },
  { step: "03", title: "Session", desc: "The shoot. We direct, capture, and adapt in real time to get the best version of every frame." },
  { step: "04", title: "Delivery", desc: "Edited gallery delivered within 7 days — web and print resolutions, all licensed." },
];


export default function PhotographyPage() {
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
          .sp-del-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
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
          .sp-process-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
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
          <section className="sp-hero" style={{ backgroundImage: `url('${storageUrl("services/photography-cover.jpg")}'), url('/new-thrive/services/photo.webp')` }}>
            <div className="sp-hero-overlay" />
            <div className="sp-hero-left">
              <div>
                <h1 className="sp-hero-h1">PHOTO-<br />GRAPHY</h1>
              </div>
              <div>
                <p className="sp-hero-sub" style={{ color: ACCENT }}>VISUALS THAT TELL YOUR STORY</p>
                <p className="sp-hero-desc">
                  Brand photography and visual storytelling that captures real culture, real
                  beauty, and real depth — bold, intentional, unforgettable.
                </p>
              </div>
              <div className="sp-hero-actions">
                <a href="/contact" className="sp-btn-primary" style={{ background: ACCENT, color: ACCENT_TEXT }}>
                  BOOK A SESSION →
                </a>
                <a href="/services" className="sp-btn-secondary">← ALL SERVICES</a>
              </div>
            </div>
          </section>

          <section className="sp-deliverables">
            <h2 className="sp-section-heading">IMAGES THAT<br />MAKE AN IMPRESSION</h2>
            <div className="sp-del-grid">
              {DELIVERABLES.map((d, i) => (
                <div key={i} className="sticker-card sp-del-card">
                  <h3 className="sp-del-title">{d.title}</h3>
                  <p className="sp-del-desc">{d.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <PhotoStrip photos={WORK_PHOTOS["photography"]} title="2026 grad portraits" />

          <section className="sp-process">
            <h2 className="sp-section-heading">FROM BRIEF<br />TO GALLERY</h2>
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

          <ServicePricing slug="photography" accent={ACCENT} accentText={ACCENT_TEXT} />



          <ServiceTestimonials slug="photography" accent={"#0a0a0a"} />

          {/* FAQ */}
          <ServiceFaq slug="photography" accent={"#0a0a0a"} />

          <section className="sp-cta" style={{ background: ACCENT }}>
            <h2 className="sp-cta-heading" style={{ color: ACCENT_TEXT }}>READY TO CAPTURE<br />YOUR BRAND?</h2>
            <p className="sp-cta-sub" style={{ color: "rgba(0,0,0,0.6)" }}>
              Every business has a story worth showing. Let&apos;s make sure yours looks as good as it actually is.
            </p>
            <a href="/contact" className="sp-btn-primary" style={{ background: "#000", color: "#fff" }}>
              BOOK A SESSION →
            </a>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
