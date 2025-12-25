// src/app/contact/page.tsx
import ContactForm from "./ContactForm";

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
            <h1 className="hero-title">Tell me about the project you&apos;re dreaming up.</h1>
            <p className="hero-text">
              I work with small businesses, artists, churches, and creators who need design that feels
              intentional—from branding and posters to product UI and launch content. Share a bit about
              what you need and I&apos;ll get back to you with next steps.
            </p>

            {/* ✅ Client form lives here */}
            <ContactForm />

          </div>
        </section>
      </main>
    </div>
  );
}
