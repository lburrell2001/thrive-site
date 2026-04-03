import type { Metadata } from "next";
import PublicLayout from "../../components/PublicLayout";
import { storageUrl } from "@/lib/storage";
import { buildPageMetadata } from "@/lib/seo";
import { supabase } from "@/lib/supabaseServer";

export const metadata: Metadata = buildPageMetadata({
  title: "Digital Design",
  description:
    "Web design, landing pages, and digital assets built from the ground up — infused with strategy and a visual identity that sets you apart.",
  path: "/services/digital-design",
  keywords: [
    "web design Dallas TX",
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
  { title: "Website Design", desc: "Multi-page site designs built for your audience — from homepage to contact." },
  { title: "Landing Pages", desc: "Conversion-focused single pages that drive sign-ups, sales, or inquiries." },
  { title: "Digital Assets", desc: "Email headers, ad creatives, digital banners — everything you need to show up online." },
  { title: "Brand Implementation", desc: "Your existing brand applied consistently across every digital touchpoint." },
  { title: "Mobile-First Layouts", desc: "Every design is built to look great on phones, tablets, and desktops." },
  { title: "Handoff-Ready Files", desc: "Developer-ready Figma files, specs, and export-ready assets — no guesswork." },
];

const PROCESS = [
  { step: "01", title: "Discovery", desc: "We align on goals, audience, and the pages you need to get there." },
  { step: "02", title: "Wireframes", desc: "Structural layouts first — we map out content hierarchy before any visuals." },
  { step: "03", title: "Design", desc: "Full visual design applied: color, type, imagery, interactions." },
  { step: "04", title: "Handoff", desc: "Final Figma files, assets, and specs ready for development or launch." },
];


type FeaturedProject = { id: string; title: string; slug: string; category: string; tagline: string | null };

async function getFeaturedProjects(serviceSlug: string): Promise<FeaturedProject[]> {
  const { data: rows } = await supabase
    .from('service_featured_projects')
    .select('project_slug, display_order')
    .eq('service_slug', serviceSlug)
    .order('display_order', { ascending: true }) as {
      data: { project_slug: string; display_order: number }[] | null;
    };
  if (!rows || rows.length === 0) return [];
  const slugs = rows.map(r => r.project_slug);
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, slug, category, tagline')
    .in('slug', slugs) as { data: FeaturedProject[] | null };
  if (!projects) return [];
  const order = Object.fromEntries(rows.map(r => [r.project_slug, r.display_order]));
  return projects.sort((a, b) => (order[a.slug] ?? 0) - (order[b.slug] ?? 0));
}

export default async function DigitalDesignPage() {
  const featured = await getFeaturedProjects('digital-design');

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
          .sp-hero-eyebrow {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.6);
            margin-bottom: 16px;
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
          .sp-section-eyebrow {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #888;
            margin-bottom: 12px;
          }
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
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 24px;
          }
          .sp-del-bar { height: 3px; border-radius: 2px; margin-bottom: 16px; }
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
            color: #808080;
            margin: 0;
          }
          .sp-process { background: #0a0a0a; padding: 80px; box-sizing: border-box; }
          .sp-process .sp-section-heading { color: #fff; }
          .sp-process .sp-section-eyebrow { color: #555; }
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
          .sp-portfolio-link {
            background: #f5f4f2;
            padding: 80px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 32px;
            flex-wrap: wrap;
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
          .sp-featured { background: #fff; padding: 80px; box-sizing: border-box; }
          .sp-work-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .sp-work-card {
            border-radius: 12px; overflow: hidden;
            border: 1px solid #e5e5e5; text-decoration: none;
            color: inherit; display: block; transition: transform .2s;
          }
          .sp-work-card:hover { transform: translateY(-4px); }
          .sp-work-img { aspect-ratio: 16 / 10; overflow: hidden; background: #f0f0f0; }
          .sp-work-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
          .sp-work-card:hover .sp-work-img img { transform: scale(1.04); }
          .sp-work-info { padding: 16px 20px 20px; }
          .sp-work-cat {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
            color: #808080; margin: 0 0 4px;
          }
          .sp-work-name {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 18px; letter-spacing: -0.02em; margin: 0;
          }
          /* ── TABLET ── */
          @media (max-width: 960px) {
            .sp-hero-left { padding: 60px 48px; }
            .sp-deliverables,
            .sp-process,
            .sp-featured { padding: 60px 48px; }
            .sp-portfolio-link { padding: 60px 48px; }
            .sp-cta { padding: 80px 48px; }
            .sp-del-grid { grid-template-columns: repeat(2, 1fr); }
            .sp-process-steps { grid-template-columns: repeat(2, 1fr); }
            .sp-work-grid { grid-template-columns: repeat(2, 1fr); }
          }

          @media (max-width: 767px) {
            .sp-hero { min-height: 480px; }
            .sp-hero-left { padding: 48px 24px; gap: 32px; }
            .sp-deliverables,
            .sp-process,
            .sp-featured { padding: 60px 24px; }
            .sp-portfolio-link { padding: 48px 24px; flex-direction: column; align-items: flex-start; }
            .sp-cta { padding: 72px 24px; }
            .sp-del-grid { grid-template-columns: 1fr; }
            .sp-process-steps { grid-template-columns: 1fr 1fr; }
            .sp-work-grid { grid-template-columns: 1fr; }
          }
          @media (max-width: 480px) {
            .sp-process-steps { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="sp-page">
          <section className="sp-hero" style={{ backgroundImage: `url('${storageUrl("services/digital-design-cover.jpg")}'), url('/new-thrive/services/digital-design.jpg')` }}>
            <div className="sp-hero-overlay" />
            <div className="sp-hero-left">
              <div>
                <p className="sp-hero-eyebrow">01 — Digital</p>
                <h1 className="sp-hero-h1">DIGITAL<br />DESIGN</h1>
              </div>
              <div>
                <p className="sp-hero-sub" style={{ color: ACCENT }}>ALL YOURS IN ONLY 2–4 WEEKS</p>
                <p className="sp-hero-desc">
                  Web design, landing pages, and digital assets built from the ground up —
                  infused with strategy and a visual identity that sets you apart.
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

          <section className="sp-deliverables">
            <p className="sp-section-eyebrow">What you get</p>
            <h2 className="sp-section-heading">DIGITAL PRESENCE,<br />FULLY DESIGNED</h2>
            <div className="sp-del-grid">
              {DELIVERABLES.map((d, i) => (
                <div key={i} className="sp-del-card">
                  <div className="sp-del-bar" style={{ background: ACCENT }} />
                  <h3 className="sp-del-title">{d.title}</h3>
                  <p className="sp-del-desc">{d.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sp-process">
            <p className="sp-section-eyebrow">Timeline</p>
            <h2 className="sp-section-heading">FROM BRIEF<br />TO LAUNCH-READY</h2>
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

          {featured && featured.length > 0 ? (
            <section className="sp-featured">
              <p className="sp-section-eyebrow">Recent work</p>
              <h2 className="sp-section-heading">SEE WHAT WE&apos;VE<br />BEEN BUILDING</h2>
              <div className="sp-work-grid">
                {featured.map((p) => (
                  <a key={p.id} href={`/work/${p.slug}`} className="sp-work-card">
                    <div className="sp-work-img">
                      <img src={storageUrl(`work/${p.slug}-cover.jpg`)} alt={p.title} />
                    </div>
                    <div className="sp-work-info">
                      <p className="sp-work-cat">{p.category}</p>
                      <h3 className="sp-work-name">{p.title}</h3>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : (
            <div className="sp-portfolio-link">
              <div>
                <p className="sp-section-eyebrow">Our work</p>
                <h2 className="sp-section-heading" style={{ margin: 0 }}>SEE WHAT WE&apos;VE<br />BEEN BUILDING</h2>
              </div>
              <a href="/portfolio" className="sp-btn-primary" style={{ background: "#0a0a0a", color: "#fff", flexShrink: 0 }}>
                VIEW PORTFOLIO →
              </a>
            </div>
          )}

          <section className="sp-cta" style={{ background: ACCENT }}>
            <h2 className="sp-cta-heading" style={{ color: ACCENT_TEXT }}>READY TO LEVEL UP<br />YOUR DIGITAL PRESENCE?</h2>
            <p className="sp-cta-sub" style={{ color: "rgba(255,255,255,0.7)" }}>
              Tell us what you&apos;re building and we&apos;ll put together a design package that works for your timeline and budget.
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
