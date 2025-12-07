<header className="site-header">
  <div className="wrapper site-header-inner">
    <div className="logo-lockup">
      <span className="logo-mark" />
      <span>Thrive Creative Studios</span>
    </div>

    <nav className="nav-links">
      <a href="/">Home</a>
      <a href="/work">Work</a>
      <a href="/services">Services</a>
      <a href="/contact" className="nav-cta">
        Let&apos;s work
      </a>
    </nav>
  </div>
</header>

export const metadata = {
  title: "Services & Bundles · Thrive Creative Studios",
};

export default function ServicesPage() {
  return (
    <div className="page">
      <main className="hero">
        <div className="wrapper">
          <div className="hero-tag">Services & Bundles</div>
          <h1 className="hero-title">
            Flexible design support for brands, artists, and small teams.
          </h1>
          <p className="hero-text">
            Whether you need one visual or a full brand experience, Thrive
            offers à la carte services and curated bundles to match your goals
            and timeline.
          </p>

          <section style={{ marginTop: 32 }}>
            <h2 className="hero-title" style={{ fontSize: 20, marginBottom: 8 }}>
              Individual services
            </h2>
            <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
              <li>Poster design — starting at $50</li>
              <li>Logo design — starting at $75</li>
              <li>UX/UI design — starting at $100</li>
              <li>2D motion graphics — starting at $100</li>
              <li>
                Social media graphics — $60 for 3 posts · $90 for 5 posts
              </li>
            </ul>
          </section>

          <section style={{ marginTop: 28 }}>
            <h2 className="hero-title" style={{ fontSize: 20, marginBottom: 8 }}>
              Bundles
            </h2>
            <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
              <li>
                <strong>Starter Brand Kit — $180</strong>
                <br />
                Logo, custom color palette, and 3 matching social posts.
              </li>
              <li>
                <strong>Motion + Promo Kit — $200</strong>
                <br />
                1 motion graphic, 1 flyer/poster, and 3 social posts.
              </li>
              <li>
                <strong>Full Visual Launch Kit — $275</strong>
                <br />
                Logo, color palette, motion graphic, 1 poster, and 3–5 social
                posts.
              </li>
              <li>
                <strong>Monthly Visual Retainer — $220/month</strong>
                <br />
                Up to 3 small design projects per month with priority delivery.
              </li>
            </ul>
          </section>

          <section style={{ marginTop: 28, fontSize: 14, maxWidth: 520 }}>
            <p>
              All confirmed bookings require a $30 deposit. Once you submit a
              booking request, you&apos;ll receive an invitation for a discovery
              call—during that call, the deposit is collected and we lock in
              your spot.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

