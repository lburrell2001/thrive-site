import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Social Media + Graphics · Thrive Creative Studios",
};

type SocialProject = {
  title: string;
  cardTitle: string;
  slug: string;
  cover: string;
  alt: string;
  kicker: string;
};

const SOCIAL_FEATURED: SocialProject[] = [
  {
    title: "Thrive Creative Studios Social Media Management + Graphics Creation",
    cardTitle: "Thrive Creative Studios Social Media + Graphics",
    slug: "thrive-social-media-management-graphics-creation",
    cover: "/services/social/thrive-feed-01.jpg",
    alt: "Thrive Creative Studios social media feed design preview",
    kicker: "Social + Graphics",
  },
  {
    title: "Roots to Wellness Social Media Management + Graphics Creation",
    cardTitle: "Roots to Wellness Social Media + Graphics",
    slug: "roots-to-wellness-social-media-management-graphics-creation",
    cover: "/services/social/rootstowellnessnow-feed-01.png",
    alt: "Roots to Wellness social media feed design preview",
    kicker: "Social + Graphics",
  },
];

function FeaturedSocialGallery() {
  return (
    <section className="featured-gallery" aria-label="Featured social media projects">
      <div className="wrapper">
        <div className="featured-gallery__header">
          <p className="hero-tag">Featured social projects</p>
          <h2 className="hero-title">Real accounts, real content systems.</h2>
          <p className="hero-text">
            Two examples of how I combine strategy, posting rhythm, and graphic design
            into one social media service.
          </p>
        </div>

        <div className="gallery-grid">
          {SOCIAL_FEATURED.map((project) => (
            <Link
              key={project.slug}
              href={`/work/${project.slug}`}
              className="gallery-card is-grid social-gallery-card"
              aria-label={`View ${project.title} project`}
            >
              <div className="gallery-media">
                <img src={project.cover} alt={project.alt} className="gallery-img" />
              </div>

              <div className="gallery-overlay">
                <span className="gallery-kicker">{project.kicker}</span>
                <h3 className="gallery-title">{project.cardTitle}</h3>
                <span className="gallery-cta">View project →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function SocialMediaManagementPage() {
  return (
    <div className="page">
      <SiteHeader />

      <main className="service-page">
        <section
          className="service-video-hero"
          aria-label="Social media management and graphics creation service overview"
        >
          <div className="service-video-bg" aria-hidden="true">
            <video
              className="service-video"
              src="/services/social/hero-social.mp4"
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

                <h1 className="service-title">Social Media Management + Graphics Creation</h1>

                <p className="service-subtitle">
                  I build your monthly content strategy, manage posting, and design your
                  feed, carousels, stories, and reels so your brand looks consistent and
                  performs with purpose.
                </p>
              </div>

              <div className="service-video-columns">
                <div>
                  <h3 className="service-h2">Best for</h3>
                  <ul className="service-list">
                    <li>Brands that need consistent weekly content without burnout</li>
                    <li>Businesses ready for strategy + design in one service</li>
                    <li>Founders who need done-for-you social media execution</li>
                    <li>Teams that want stronger brand consistency on Instagram</li>
                  </ul>
                </div>

                <div>
                  <h3 className="service-h2">What’s included</h3>
                  <ul className="service-list">
                    <li>Monthly strategy and content calendar</li>
                    <li>Caption support and post scheduling</li>
                    <li>Graphic design for feed posts, carousels, and stories</li>
                    <li>Reel planning and visual direction</li>
                  </ul>
                </div>
              </div>

              <div className="hero-actions">
                <a
                  href="mailto:thrivecreativestudios@gmail.com?subject=Social%20Media%20Management%20Inquiry"
                  className="btn btn-primary"
                >
                  Book Social Media + Graphics
                </a>

                <Link href="/services" className="btn btn-secondary">
                  Back to services
                </Link>
              </div>
            </div>
          </div>
        </section>

        <FeaturedSocialGallery />

        <section className="process-section" aria-label="Social media process timeline">
          <div className="wrapper">
            <div className="process-header">
              <p className="hero-tag">Timeline</p>
              <h2 className="hero-title">How we run your monthly social system.</h2>
              <p className="hero-text">
                A clear workflow that keeps strategy, posting, and design moving together.
              </p>
            </div>

            <div className="process-stack" role="list">
              <article className="process-card pc-1" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">01</span>
                  <h3 className="process-title">Strategy + planning</h3>
                </div>
                <p className="process-desc">
                  We set monthly goals, content pillars, and a practical posting cadence.
                </p>
              </article>

              <article className="process-card pc-2" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">02</span>
                  <h3 className="process-title">Content mapping</h3>
                </div>
                <p className="process-desc">
                  I map feed posts, carousels, stories, and reels into a clean content plan.
                </p>
              </article>

              <article className="process-card pc-3" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">03</span>
                  <h3 className="process-title">Design + production</h3>
                </div>
                <p className="process-desc">
                  Visual assets are designed, refined, and prepared for publish-ready delivery.
                </p>
              </article>

              <article className="process-card pc-4" role="listitem">
                <div className="process-card-top">
                  <span className="process-step">04</span>
                  <h3 className="process-title">Publish + optimize</h3>
                </div>
                <p className="process-desc">
                  Posts go live on schedule, then we refine based on engagement and response.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
