export const metadata = {
  title: "Contact · Thrive Creative Studios",
};

export default function ContactPage() {
  return (
    <div className="page">
      {/* Header */}
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

      <main>
        <section className="hero section-halftone">
          <div className="wrapper">
            <div className="hero-tag">Contact</div>
            <h1 className="hero-title">
              Tell me about the project you&apos;re dreaming up.
            </h1>
            <p className="hero-text">
              I work with small businesses, artists, churches, and creators who
              need design that feels intentional—from branding and posters to
              product UI and launch content. Share a bit about what you need and
              I&apos;ll get back to you with next steps.
            </p>

            <form
              style={{
                marginTop: 32,
                maxWidth: 560,
                display: "grid",
                gap: 16,
                fontSize: 14,
              }}
            >
              <div>
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="project-type">What are you looking for?</label>
                <select id="project-type" style={inputStyle}>
                  <option value="">Select one</option>
                  <option>Branding / logo</option>
                  <option>Poster or print design</option>
                  <option>Website / UI design</option>
                  <option>Motion graphics / video</option>
                  <option>Social media graphics</option>
                  <option>Something else</option>
                </select>
              </div>

              <div>
                <label htmlFor="budget">Estimated budget</label>
                <select id="budget" style={inputStyle}>
                  <option value="">Choose a range</option>
                  <option>Under $200</option>
                  <option>$200 – $400</option>
                  <option>$400 – $750</option>
                  <option>$750+</option>
                </select>
              </div>

              <div>
                <label htmlFor="timeline">Timeline</label>
                <input
                  id="timeline"
                  type="text"
                  placeholder="For example: launch in March, or flexible"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="message">Project details</label>
                <textarea
                  id="message"
                  placeholder="Tell me about your brand, goals, and any links you'd like to share."
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                All confirmed bookings require a $30 deposit to secure your
                spot. After you submit this form, I&apos;ll follow up with a
                quick discovery call and next steps.
              </p>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: 8, width: "fit-content" }}
              >
                Submit inquiry
              </button>

              <p style={{ fontSize: 12, color: "#555", marginTop: 12 }}>
                Prefer email? Reach me at{" "}
                <a
                  href="mailto:hello@thrivecreativestudios.com"
                  style={{ textDecoration: "underline" }}
                >
                  hello@thrivecreativestudios.com
                </a>
                .
              </p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

// tiny inline style helper
const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 14,
  outline: "none",
};
