// app/services/page.tsx
import SiteHeader from "../components/SiteHeader";
import Link from "next/link";
import { MEDIA } from "@/lib/medita";

export const metadata = {
  title: "Services & Bundles · Thrive Creative Studios",
};

type Pill = {
  title: string;
  tag: string;
  blurb: string;
  href: string;
  videoSrc: string;
};

const PILL_CARDS: Pill[] = [
  {
    title: "Branding",
    tag: "Identity · Logos · Visual Systems",
    blurb:
      "Logos, color systems, type pairing, and templates that make your brand feel like you—everywhere.",
    href: "/services/branding",
    videoSrc: MEDIA.videos.branding,
  },
  {
    title: "Web + UX",
    tag: "Web Design · UX · Builds",
    blurb:
      "Websites and product experiences that look good, read clean, and convert without feeling salesy.",
    href: "/services/web-ux",
    videoSrc: MEDIA.videos.webux,
  },
  {
    title: "Web + App Dev",
    tag: "Front-end · Full-stack · Deployments",
    blurb:
      "Custom websites and web apps built to be fast, responsive, and ready to scale—without the tech headache.",
    href: "/services/web-app-dev",
    videoSrc: MEDIA.hero.webAppDev, // ✅ thrive-hero-v2.mp4
  },
];


function ServicePills() {
  return (
    <div className="pill-grid" aria-label="Primary services">
      {PILL_CARDS.map((pill) => (
        <Link
          key={pill.title}
          href={pill.href}
          className="pill-card"
          aria-label={`Explore ${pill.title} services`}
        >
          <div className="pill-media" aria-hidden="true">
            <video
  className="pill-video"
  src={pill.videoSrc}
  autoPlay
  muted
  loop
  playsInline
  preload="auto"
  disablePictureInPicture
/>

            <div className="pill-overlay" />
          </div>

          <div className="pill-content">
            <p className="pill-tag">{pill.tag}</p>
            <h2 className="pill-title">{pill.title}</h2>
            <p className="pill-blurb">{pill.blurb}</p>

            <span className="pill-cta">
              Explore <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <div className="page">
      <SiteHeader />

      <main className="services">
        {/* HERO */}
        <section className="services-hero">
          <div className="wrapper">
            <p className="hero-tag">Services & Bundles</p>

            <h1 className="services-title">
              Flexible design support for brands, artists, and small teams.
            </h1>

            <p className="services-subtitle">
              Whether you need one visual or a full brand experience, Thrive offers
              à la carte services and curated bundles to match your goals and timeline.
            </p>

            <ServicePills />
          </div>
        </section>

        {/* BODY */}
        <section className="services-body">
          <div className="wrapper">
            <div className="services-block">
              <h2 className="services-h2">Individual services</h2>
              <ul className="services-list">
                <li>Poster design — starting at $50</li>
                <li>Logo design — starting at $75</li>
                <li>UX/UI design — starting at $100</li>
                <li>2D motion graphics — starting at $100</li>
                <li>Social media graphics — $60 for 3 posts · $90 for 5 posts</li>
              </ul>
            </div>

            <div className="services-block" style={{ marginTop: 18 }}>
              <h2 className="services-h2">Bundles</h2>
              <ul className="services-bundles">
                <li>
                  <strong>Starter Brand Kit — $180</strong>
                  <br />
                  Logo, custom color palette, and 3 matching social posts.
                </li>
                <li>
                  <strong>Motion + Promo Kit — $200</strong>
                  <br />1 motion graphic, 1 flyer/poster, and 3 social posts.
                </li>
                <li>
                  <strong>Full Visual Launch Kit — $275</strong>
                  <br />
                  Logo, color palette, motion graphic, 1 poster, and 3–5 social posts.
                </li>
                <li>
                  <strong>Monthly Visual Retainer — $220/month</strong>
                  <br />
                  Up to 3 small design projects per month with priority delivery.
                </li>
              </ul>
            </div>

            <div className="services-note">
              <p>
                All confirmed bookings require a $30 deposit. Once you submit a booking
                request, you&apos;ll receive an invitation for a discovery call—during
                that call, the deposit is collected and we lock in your spot.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
