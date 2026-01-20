// app/components/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Site footer">
     {/* ================= CTA BANNER ================= */}
<div className="footer-cta" aria-label="Footer call to action">
  <div className="wrapper footer-cta-wrap">
    <div className="footer-cta-card">
      <div className="footer-cta-text">
        <div className="footer-cta-eyebrow">Work with Thrive</div>
        <h3 className="footer-cta-title">Ready to bring your idea to life?</h3>
        <p className="footer-cta-subtitle">
          Let’s build a brand, website, or product that actually works — design and
          development, together.
        </p>
      </div>

      <div className="footer-cta-actions">
        <Link href="/contact" className="footer-cta-button">
          Book a free 20 min consultation
        </Link>
      </div>
    </div>
  </div>
</div>
{/* ============================================== */}


      <div className="wrapper footer-wrap">
        <div className="footer-card">
          {/* Brand */}
          <div className="footer-brand">
            <Link href="/" className="footer-logo" aria-label="Thrive Creative Studios home">
              <img src="/logo.svg" alt="Thrive Creative Studios" className="footer-logo-img" />
            </Link>

            <p className="footer-tagline">
              A one-stop creative studio for branding, ux design, and development — built to
              help your ideas look as good as they feel.
            </p>

            {/* Services pills */}
            <div className="footer-pills" aria-label="Services">
              <Link className="footer-pill" href="/services/branding">
                Brand Identity
              </Link>
              <Link className="footer-pill" href="/services/web-app-dev">
                Web &amp; App Dev
              </Link>
              <Link className="footer-pill" href="/services/web-ux">
                Web &amp; UX
              </Link>
            </div>
          </div>

          {/* Link columns */}
          <nav className="footer-links" aria-label="Footer navigation">
            <div className="footer-col">
              <div className="footer-col-title">Explore</div>
              <Link href="/services">Services</Link>
              <Link href="/work">Portfolio</Link>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <Link href="/services">Bundles</Link>
              <Link href="/contact">Work with me</Link>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Social</div>
              <a
                href="https://www.linkedin.com/company/thrive-creative-studios"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
              <a
                href="https://www.instagram.com/thrivecreativestudio_/"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            </div>
          </nav>
        </div>

        <div className="footer-bottom">
          <div>© {year} Thrive Creative Studios. All rights reserved.</div>

          <div className="footer-bottom-right">
            <a href="mailto:lauren@thrivecreativestudios.com">
              lauren@thrivecreativestudios.com
            </a>
            <span className="footer-dot" aria-hidden="true">
              •
            </span>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
