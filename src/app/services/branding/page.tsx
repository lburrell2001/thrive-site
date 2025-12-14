import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { MEDIA } from "@/lib/medita";

export const metadata = {
  title: "Branding · Thrive Creative Studios",
};

const BRANDING_FEATURED = [
  {
    title: "Brewhaus Coffee",
    slug: "brewhaus",
    cover: MEDIA.work.brewhaus,
    alt: "Brewhaus Coffee branding cover image",
  },
  {
    title: "Curl & Co.",
    slug: "curl-and-co",
    cover: MEDIA.work.curlCo,
    alt: "Curl & Co. branding cover image",
  },
  {
    title: "The Squeeze Shop",
    slug: "squeeze-shop",
    cover: MEDIA.work.squeezeShop,
    alt: "The Squeeze Shop branding cover image",
  },
];

function FeaturedBrandingGallery() {
  return (
    <section className="featured-gallery" aria-label="Featured branding projects">
      <div className="wrapper">
        <div className="featured-gallery__header">
          <p className="hero-tag">Featured branding</p>
          <h2 className="hero-title">A few recent brand builds.</h2>
          <p className="hero-text">
            Click a project to see the full identity system, visuals, and process.
          </p>
        </div>

        <div className="gallery-grid">
          {BRANDING_FEATURED.map((p) => (
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
                <span className="gallery-kicker">Branding</span>
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

export default function BrandingServicePage() {
  return (
    <div className="page">
      <SiteHeader />

      <main className="service-page">
        {/* HERO */}
        <section className="service-video-hero" aria-label="Branding service overview">
          <div className="service-video-bg" aria-hidden="true">
            <video
              className="service-video"
              src={MEDIA.hero.branding}  // ✅ Supabase video
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

                <h1 className="service-title">Branding</h1>

                <p className="service-subtitle">
                  Logos, color systems, type pairing, and templates that make your brand
                  feel like you—everywhere.
                </p>
              </div>

              <div className="service-video-columns">
                <div>
                  <h3 className="service-h2">Best for</h3>
                  <ul className="service-list">
                    <li>New businesses that need a visual foundation</li>
                    <li>Rebrands that need a cleaner, more modern look</li>
                    <li>Artists/creatives building a consistent identity</li>
                    <li>Products &amp; launches that need cohesive visuals</li>
                  </ul>
                </div>

                <div>
                  <h3 className="service-h2">Starting prices</h3>
                  <ul className="service-list">
                    <li>Logo design — starting at $75</li>
                    <li>Starter Brand Kit — $180</li>
                    <li>Full Visual Launch Kit — $275</li>
                  </ul>
                  <p className="service-note">All confirmed bookings require a $30 deposit.</p>
                </div>
              </div>

              <div className="hero-actions">
                <a
                  href="mailto:thrivecreativestudios@gmail.com?subject=Branding%20Inquiry"
                  className="btn btn-primary"
                >
                  Book Branding
                </a>

                <Link href="/services" className="btn btn-secondary">
                  Back to services
                </Link>
              </div>
            </div>
          </div>
        </section>

        <FeaturedBrandingGallery />

        <section className="process-section" aria-label="Process timeline">
          <div className="wrapper">
            <div className="process-header">
              <p className="hero-tag">Timeline</p>
              <h2 className="hero-title">Here’s how we build it together.</h2>
              <p className="hero-text">
                Simple steps, clear handoff, and a process that keeps your brand
                looking intentional the whole way through.
              </p>
            </div>

            <div className="process-stack" role="list">
              <article className="process-card pc-1" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">01</span>
                  <h3 className="process-title">Discovery</h3>
                </div>
                <p className="process-desc">
                  Quick call + vibe alignment. We lock goals, scope, and the look we’re
                  chasing.
                </p>
              </article>

              <article className="process-card pc-2" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">02</span>
                  <h3 className="process-title">Concept directions</h3>
                </div>
                <p className="process-desc">
                  2–3 visual directions (and examples) so you can choose the lane that
                  feels like you.
                </p>
              </article>

              <article className="process-card pc-3" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">03</span>
                  <h3 className="process-title">Refinement</h3>
                </div>
                <p className="process-desc">
                  We polish the system: spacing, type, color, layout decisions—everything
                  gets tight.
                </p>
              </article>

              <article className="process-card pc-4" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">04</span>
                  <h3 className="process-title">Delivery</h3>
                </div>
                <p className="process-desc">
                  Final exports + handoff. You get clean files and simple instructions
                  for using them.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
