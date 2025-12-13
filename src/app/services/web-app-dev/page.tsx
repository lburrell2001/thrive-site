import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";

export const metadata = {
  title: "Web + App Development · Thrive Creative Studios",
};

const DEV_FEATURED = [
  {
    title: "The Burrell Group Website",
    slug: "burrell-group",
    cover: "/work/burrell-group-cover.jpg",
    alt: "The Burrell Group website project cover image",
  },
  {
    title: "Anchor Academy LMS",
    slug: "anchor-academy-lms",
    cover: "/work/anchor-academy-cover.jpg",
    alt: "Anchor Academy LMS project cover image",
  },
  {
    title: "Thrive Website",
    slug: "thrive-website",
    cover: "/work/thrive-site-cover.jpg",
    alt: "Thrive Creative Studios website cover image",
  },
];

function FeaturedDevGallery() {
  return (
    <section className="featured-gallery" aria-label="Featured Web + App Dev projects">
      <div className="wrapper">
        <div className="featured-gallery__header">
          <p className="hero-tag">Featured development</p>
          <h2 className="hero-title">Built projects, not just pretty screens.</h2>
          <p className="hero-text">
            A few real builds that show structure, responsiveness, and clean implementation.
          </p>
        </div>

        <div className="gallery-grid">
          {DEV_FEATURED.map((p) => (
            <Link
              key={p.slug}
              href={`/work/${p.slug}`}
              className="gallery-card is-grid"
              aria-label={`View ${p.title} project`}
            >
              <div className="gallery-media">
                <img src={p.cover} alt={p.alt} className="gallery-img" />
              </div>

              <div className="gallery-overlay">
                <span className="gallery-kicker">Web + App Dev</span>
                <h3 className="gallery-title">{p.title}</h3>
                <span className="gallery-cta">View project →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function WebAppDevServicePage() {
  return (
    <div className="page">
      <SiteHeader />

      <main className="service-page">
        {/* VIDEO HERO (same system as your Web+UX page) */}
        <section className="service-video-hero" aria-label="Web + App Dev service hero">
          <div className="service-video-bg" aria-hidden="true">
            <video
              className="service-video"
              src="/videos/thrive-hero.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="service-video-dim" />
          </div>

          <div className="wrapper">
            <div className="service-video-card">
              {/* top: title/caption */}
              <div>
                <p className="hero-tag" style={{ marginTop: 0 }}>
                  Service
                </p>
                <h1 className="service-title">Web + App Development</h1>
                <p className="service-subtitle">
                  Custom websites and web apps built to be fast, responsive, and easy to
                  maintain—designed with real users in mind.
                </p>
              </div>

              {/* middle: two columns (Best for + Starting prices) */}
              <div className="service-video-grid" style={{ marginTop: 18 }}>
                <div className="service-mini-card">
                  <h3 className="service-h2">Best for</h3>
                  <ul className="service-list">
                    <li>Small business websites (that actually convert)</li>
                    <li>Landing pages + launches</li>
                    <li>Internal tools + dashboards</li>
                    <li>Portals, course platforms, and gated content</li>
                  </ul>
                </div>

                <div className="service-mini-card">
                  <h3 className="service-h2">Starting prices</h3>
                  <ul className="service-list">
                    <li>Website build — scoped per project</li>
                    <li>Web app build — scoped per project</li>
                    <li>Monthly support/retainer — available</li>
                  </ul>
                  <p className="service-note" style={{ marginTop: 10 }}>
                    All confirmed bookings require a $30 deposit.
                  </p>
                </div>
              </div>

              {/* bottom: buttons side-by-side */}
              <div className="hero-actions" style={{ marginTop: 18 }}>
                <a
                  href="mailto:thrivecreativestudios@gmail.com?subject=Web%20%2B%20App%20Dev%20Inquiry"
                  className="btn btn-primary"
                >
                  Book Web + App Dev
                </a>

                <Link href="/services" className="btn btn-secondary">
                  Back to services
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED PROJECTS */}
        <FeaturedDevGallery />

        {/* PROCESS */}
        <section className="process-section" aria-label="Development process timeline">
          <div className="wrapper">
            <div className="process-header">
              <p className="hero-tag">Timeline</p>
              <h2 className="hero-title">How we build it (without chaos).</h2>
              <p className="hero-text">
                Clear milestones, clean handoff, and a build that’s easy to own after launch.
              </p>
            </div>

            <div className="process-stack" role="list">
              <article className="process-card pc-1" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">01</span>
                  <h3 className="process-title">Plan + scope</h3>
                </div>
                <p className="process-desc">
                  We define pages/features, integrations, content needs, and timeline.
                </p>
              </article>

              <article className="process-card pc-2" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">02</span>
                  <h3 className="process-title">Build the foundation</h3>
                </div>
                <p className="process-desc">
                  Components, routes, CMS/data, auth (if needed), and responsive structure.
                </p>
              </article>

              <article className="process-card pc-3" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">03</span>
                  <h3 className="process-title">Polish + QA</h3>
                </div>
                <p className="process-desc">
                  Performance checks, mobile fixes, accessibility passes, and final content.
                </p>
              </article>

              <article className="process-card pc-4" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">04</span>
                  <h3 className="process-title">Launch + handoff</h3>
                </div>
                <p className="process-desc">
                  Deploy, connect domain, and deliver docs so you’re not stuck later.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
