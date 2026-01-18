// src/app/contact/page.tsx
import SiteHeader from "../components/SiteHeader";
import ContactForm from "./ContactForm";
import SiteFooter from "../components/SiteFooter";

export const metadata = {
  title: "Contact · Thrive Creative Studios",
};

export default function ContactPage() {
  return (
    <div className="page">
      {/* Global Site Header */}
      <SiteHeader />

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

            {/* Contact form */}
            <ContactForm />

          </div>
        </section>
      </main>
      {/* =======================
                7. FOOTER
            ======================== */}
            <SiteFooter />
    </div>
  );
}
