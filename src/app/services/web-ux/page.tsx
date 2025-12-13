import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";

export const metadata = {
  title: "Web + UX · Thrive Creative Studios",
};

const WEBUX_FEATURED = [
  {
    title: "TCKT",
    slug: "tckt",
    cover: "/work/tckt-cover.jpg",
    alt: "TCKT UX & web case study cover image",
  },
  {
    title: "SoulCheck",
    slug: "soulcheck",
    cover: "/work/soulcheck-cover.jpg",
    alt: "SoulCheck UX design cover image",
  },
  {
    title: "SafeSpace",
    slug: "safespace",
    cover: "/work/safespace-cover.jpg",
    alt: "SafeSpace UX design cover image",
  },
];

function FeaturedWebUxGallery() {
  return (
    <section className="featured-gallery" aria-label="Featured Web + UX projects">
      <div className="wrapper">
        <div className="featured-gallery__header">
          <p className="hero-tag">Featured Web + UX</p>
          <h2 className="hero-title">A few recent UX &amp; digital projects.</h2>
          <p className="hero-text">
            Click a project to see the screens, flows, and design thinking behind them.
          </p>
        </div>

        <div className="gallery-grid">
          {WEBUX_FEATURED.map((p) => (
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
                <span className="gallery-kicker">Web + UX</span>
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

export default function WebUxServicePage() {
  return (
    <div className="page">
      <SiteHeader />

      <main className="service-page">
        <section
  className="service-video-hero"
  aria-label="Web + UX service overview"
>
  {/* video bg */}
  <div className="service-video-bg" aria-hidden="true">
    <video
      className="service-video"
      src="/videos/uxhero.mp4"
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
      {/* ===================
          TOP COPY
      =================== */}
      <div className="service-video-header">
        <p className="hero-tag" style={{ marginTop: 0 }}>
          Service
        </p>

        <h1 className="service-title">Web + UX</h1>

        <p className="service-subtitle">
          Websites and digital experiences that look good, read clearly, and feel
          intuitive—built with strategy and care.
        </p>
      </div>

      {/* ===================
          TWO-COLUMN INFO
      =================== */}
      <div className="service-video-columns">
        <div>
          <h3 className="service-h2">Best for</h3>
          <ul className="service-list">
            <li>Small business websites</li>
            <li>Portfolio + personal brands</li>
            <li>Landing pages + launches</li>
            <li>UX flows for apps/products</li>
          </ul>
        </div>

        <div>
          <h3 className="service-h2">Starting prices</h3>
          <ul className="service-list">
            <li>UX/UI design — starting at $100</li>
            <li>Website design/build — scoped per project</li>
            <li>Monthly visual retainer — $220/month</li>
          </ul>
        </div>
      </div>

      {/* ===================
          BUTTON ROW
      =================== */}
      <div className="hero-actions">
        <a
          href="mailto:thrivecreativestudios@gmail.com?subject=Web%20%2B%20UX%20Inquiry"
          className="btn btn-primary"
        >
          Book Web + UX
        </a>

        <Link href="/services" className="btn btn-secondary">
          Back to services
        </Link>
      </div>
    </div>
  </div>
</section>


        {/* FEATURED PROJECTS */}
        <FeaturedWebUxGallery />

        {/* PROCESS / TIMELINE */}
        <section className="process-section" aria-label="Process timeline">
          <div className="wrapper">
            <div className="process-header">
              <p className="hero-tag">Timeline</p>
              <h2 className="hero-title">Here’s how we build it together.</h2>
              <p className="hero-text">
                Clear steps, clean design, and a smooth handoff—whether I’m building it or
                passing it to dev.
              </p>
            </div>

            <div className="process-stack" role="list">
              <article className="process-card pc-1" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">01</span>
                  <h3 className="process-title">Discovery</h3>
                </div>
                <p className="process-desc">
                  We lock goals, pages, audience, and references—then confirm scope and
                  timeline.
                </p>
              </article>

              <article className="process-card pc-2" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">02</span>
                  <h3 className="process-title">Layout + flow</h3>
                </div>
                <p className="process-desc">
                  Wireframes and structure first so the experience makes sense before we
                  style anything.
                </p>
              </article>

              <article className="process-card pc-3" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">03</span>
                  <h3 className="process-title">UI + build</h3>
                </div>
                <p className="process-desc">
                  High-fidelity screens (and optional build). Everything gets responsive and
                  consistent.
                </p>
              </article>

              <article className="process-card pc-4" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">04</span>
                  <h3 className="process-title">Launch</h3>
                </div>
                <p className="process-desc">
                  Final QA, export/handoff, and a clean delivery so you can publish
                  confidently.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
