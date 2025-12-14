import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { MEDIA } from "@/lib/medita";

export const metadata = {
  title: "Web + UX · Thrive Creative Studios",
};

const WEBUX_FEATURED = [
  {
    title: "TCKT",
    slug: "tckt",
    cover: MEDIA.work.tckt,
    alt: "TCKT UX & web case study cover image",
  },
  {
    title: "SoulCheck",
    slug: "soulcheck",
    cover: MEDIA.work.soulcheck,
    alt: "SoulCheck UX design cover image",
  },
  {
    title: "SafeSpace",
    slug: "safespace",
    cover: MEDIA.work.safespace,
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
        <section className="service-video-hero" aria-label="Web + UX service overview">
          <div className="service-video-bg" aria-hidden="true">
            <video
              className="service-video"
              src={MEDIA.hero.webux}   // ✅ uses ux-hero.mp4 in bucket root
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
            />
            <div className="service-video-dim" />
          </div>

          <div className="wrapper">
            <div className="service-video-card">
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

        <FeaturedWebUxGallery />
        {/* process section stays the same */}
      </main>
    </div>
  );
}
