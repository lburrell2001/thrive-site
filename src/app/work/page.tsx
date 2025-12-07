// app/work/page.tsx
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

export default function WorkPage() {
  return (
    <div className="page">
      <SiteHeader />

      <main>
        <section className="work-hero">
          <div className="wrapper">
            <p className="hero-tag">Selected work</p>
            <h1 className="hero-title">
              Branding, web, and content at the intersection of design and
              development.
            </h1>
            <p className="hero-text">
              These projects show how Thrive brings together visual identity,
              UX, and content to build work that feels cohesive—from church
              websites and coffee packaging to product concepts and social
              content.
            </p>

            <div className="work-grid-inner">
              {/* 1. St. John */}
              <Link
                href="#"
                className="work-card work-card--blue"
              >
                <p className="work-tag">UX · WEB DESIGN · CONTENT</p>
                <h3 className="work-title">
                  St. John Baptist Church — website redesign
                </h3>
                <p className="work-meta">
                  A modern, welcoming website for an Amarillo church, focused
                  on accessibility, mobile-first structure, and warm
                  storytelling.
                </p>
                <p className="work-meta">
                  UX design, website design, graphic design, content writing
                </p>
              </Link>

              {/* 2. TCKT */}
              <Link
                href="#"
                className="work-card work-card--purple"
              >
                <p className="work-tag">PRODUCT UX · UI</p>
                <h3 className="work-title">
                  TCKT — movie ticketing experience
                </h3>
                <p className="work-meta">
                  A seamless ticketing app concept that brings browsing, buying,
                  and loyalty tracking into a single, scroll-friendly interface.
                </p>
                <p className="work-meta">
                  UX design, UI design, brand design, front-end mockup
                </p>
              </Link>

              {/* 3. SafeSpace */}
              <Link
                href="#"
                className="work-card work-card--mint"
              >
                <p className="work-tag">UX · PRODUCT · 3D</p>
                <h3 className="work-title">
                  SafeSpace — hypnotherapy support tools
                </h3>
                <p className="work-meta">
                  A HIPAA-conscious iPad + VR system designed to help therapists
                  guide patients through regression with a tangible, customizable
                  safe space.
                </p>
                <p className="work-meta">
                  Product design, UX, front-end dev, 3D/game design, brand
                  design
                </p>
              </Link>

              {/* 4. Squeeze Shop */}
              <Link
                href="#"
                className="work-card work-card--orange"
              >
                <p className="work-tag">BRANDING · ILLUSTRATION</p>
                <h3 className="work-title">
                  The Squeeze Shop — lemonade brand world
                </h3>
                <p className="work-meta">
                  A fictional lemonade and snack bar with a rubberhose mascot,
                  retro-inspired logo suite, and playful packaging explorations.
                </p>
                <p className="work-meta">
                  Brand identity, illustration, packaging, merch
                </p>
              </Link>

              {/* 5. BrewHaus */}
              <Link
                href="#"
                className="work-card work-card--magenta"
              >
                <p className="work-tag">BRANDING · PACKAGING</p>
                <h3 className="work-title">
                  BrewHaus — cozy coffee brand identity
                </h3>
                <p className="work-meta">
                  A bold, cozy coffee brand with logo system, bag concepts, and
                  social graphics inspired by neighborhood cafés.
                </p>
                <p className="work-meta">
                  Brand identity, packaging, social graphics
                </p>
              </Link>

              {/* 6. DJ Mastamind */}
              <Link
                href="#"
                className="work-card work-card--purple"
              >
                <p className="work-tag">BRANDING · MUSIC</p>
                <h3 className="work-title">
                  DJ Mastamind — high-impact artist brand
                </h3>
                <p className="work-meta">
                  A loud, cerebral identity for a Dallas DJ, blending bold
                  typography with cartoon-bold visuals for merch and socials.
                </p>
                <p className="work-meta">
                  Brand identity, merch concepts, social graphics
                </p>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
