"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import { createClient } from "@supabase/supabase-js";
import SiteFooter from "./components/SiteFooter";


type FeaturedProject = {
  id: string;
  title: string;
  slug: string;
  overview: string | null;
  services: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = "course-media";

function storagePublicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function HomePage() {
  // ✅ Featured project state (MUST be inside component)
  const [featured, setFeatured] = useState<FeaturedProject | null>(null);

  // ✅ Load featured project (MUST be inside component)
  useEffect(() => {
    let alive = true;

    async function loadFeatured() {
      const { data } = await supabase
        .from("projects")
        .select("id,title,slug,overview,services")
        .eq("featured", true)
        .maybeSingle();

      // fallback: show TCKT if no featured set
      if (!data) {
        const fallback = await supabase
          .from("projects")
          .select("id,title,slug,overview,services")
          .eq("slug", "tckt")
          .maybeSingle();

        if (alive) setFeatured((fallback.data as FeaturedProject) ?? null);
        return;
      }

      if (alive) setFeatured(data as FeaturedProject);
    }

    loadFeatured();
    return () => {
      alive = false;
    };
  }, []);

  // simple scroll reveal for .sr elements
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".sr"));
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sr-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page">
      <SiteHeader />

      {/* =======================
          1. HERO
      ======================== */}
      <section id="top" className="hero hero-landing">
        <div className="wrapper hero-banner">
          <div className="hero-banner-top">
            <div className="hero-banner-copy">
              <p className="hero-eyebrow">Thrive Creative Studios</p>

              <h1 className="hero-display">
                <span>Where branding</span>
                <span>meets digital execution</span>
                <span>and strategy drives every move.</span>
              </h1>

              <div className="hero-actions">
                <a href="work" className="btn btn-secondary">
                  View work
                </a>
                <a href="contact" className="btn btn-primary">
                  Work with me
                </a>
              </div>
            </div>

            <div className="hero-pills">
              <Link href="/services/branding" className="hero-pill">
                <span className="hero-pill-title">Branding</span>
                <span className="hero-pill-caption">Identity · Visual systems</span>
              </Link>

              <Link href="/services/web-ux" className="hero-pill">
                <span className="hero-pill-title">Web &amp; UX</span>
                <span className="hero-pill-caption">Websites · UX · Front-end</span>
              </Link>

              <Link href="/services/web-app-dev" className="hero-pill">
                <span className="hero-pill-title">Web &amp; App Dev</span>
                <span className="hero-pill-caption">Websites · Mobile Apps · Front-end</span>
              </Link>

              <Link href="/services/social-media-management" className="hero-pill">
                <span className="hero-pill-title">Social Media + Graphics</span>
                <span className="hero-pill-caption">Strategy · Posting · Feed + Reel design</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =======================
          2. RUNNING ORANGE STRIP
      ======================== */}
      <section className="hero-strip" aria-label="Thrive services">
        <div className="hero-strip-track">
          <span className="hero-strip-text">
            I manage your social media and design your graphics so your brand
            shows up consistently, looks polished, and converts attention into
            action. Proven style direction from @rootstowellnessnow and
            @thrivecreativestudio_. •
          </span>

          <span className="hero-strip-text" aria-hidden="true">
            I manage your social media and design your graphics so your brand
            shows up consistently, looks polished, and converts attention into
            action. Proven style direction from @rootstowellnessnow and
            @thrivecreativestudio_. •
          </span>
        </div>
      </section>

      {/* =======================
          3. FEATURED CASE STUDY BAND (WITH SCALLOP EDGE)
      ======================== */}
      <section
        id="work"
        className="section section-work section-grid squiggle-edge"
        aria-labelledby="case-heading"
      >
        <div className="wrapper sr">
          <p className="hero-tag">This is Thrive</p>
          <h2 id="case-heading" className="hero-title">
            A studio with an eye for narrative and a{" "}
            <span className="hero-highlight">passion for visuals</span>.
          </h2>

          <div className="case-card">
            {/* left: phone style image */}
            <div className="case-phone">
  {featured ? (
    <video
  src={storagePublicUrl("videos/webux.mp4")}
  className="case-phone-video"
  autoPlay
  muted
  loop
  playsInline
/>

  ) : (
    <div className="case-phone-skeleton" aria-hidden="true" />
  )}
</div>


            {/* right: case info */}
            <div className="case-copy">
              <p className="case-kicker">Case Study</p>

              <h3 className="case-title">
                {featured ? `${featured.title} — case study` : "Featured project — case study"}
              </h3>

              <p className="case-text">
                {featured?.overview ??
                  "Explore how Thrive Creative Studios combines strategy, design, and execution to deliver clear, high-impact client results."}
              </p>

              <p className="case-services">
                {featured?.services ?? "UX design · UI design · brand design"}
              </p>

              {/* stats (still styled, can be real later) */}
              <div className="case-stats">
                <div>
                  <span className="case-stat-number">3x</span>
                  <span className="case-stat-label">Faster checkout flow</span>
                </div>
                <div>
                  <span className="case-stat-number">+40%</span>
                  <span className="case-stat-label">Return visitors</span>
                </div>
                <div>
                  <span className="case-stat-number">0</span>
                  <span className="case-stat-label">Broken experiences</span>
                </div>
              </div>

              <div className="hero-actions" style={{ marginTop: 18 }}>
                <Link
                  href={featured ? `/work/${featured.slug}` : "/work"}
                  className="btn btn-secondary"
                >
                  View full case study
                </Link>

                <Link
                  href="/work"
                  className="btn btn-secondary"
                  style={{ marginLeft: 10 }}
                >
                  View all case studies
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ scallop bottom edge (kept inside the same #work section) */}
        <div className="scallop-edge__svg" aria-hidden="true">
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none">
            <path
              d="
                M0,80
                Q60,0 120,80
                T240,80
                T360,80
                T480,80
                T600,80
                T720,80
                T840,80
                T960,80
                T1080,80
                T1200,80
                T1320,80
                T1440,80
                L1440,160 L0,160 Z
              "
              fill="var(--next-section-bg)"
            />
            <path
              d="
                M0,80
                Q60,0 120,80
                T240,80
                T360,80
                T480,80
                T600,80
                T720,80
                T840,80
                T960,80
                T1080,80
                T1200,80
                T1320,80
                T1440,80
              "
              fill="none"
              stroke="var(--section-bg)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      {/* =======================
          4. WAYS TO WORK WITH ME
      ======================== */}
      <section
        id="services"
        className="hero hero-services-band"
        aria-labelledby="services-heading"
      >
        <div className="wrapper">
          <h2 id="services-heading" className="hero-title sr">
            ways to work with Thrive.
          </h2>

          <div className="services-row sr">
            <div className="work-card work-card--magenta services-card">
              <p className="work-tag">Branding &amp; Illustration</p>
              <p className="work-title">Brand identity &amp; merch</p>
              <p className="work-meta">
                Logos, visual systems, social templates and merch that feel
                custom—not canned.
              </p>
            </div>

            <div className="work-card work-card--blue services-card">
              <p className="work-tag">UX &amp; Web</p>
              <p className="work-title">Websites &amp; digital products</p>
              <p className="work-meta">
                Strategy, UX flows and front-end builds for sites, LMS platforms
                and digital experiences.
              </p>
            </div>

            <div className="work-card work-card--orange services-card">
              <p className="work-tag">Website &amp; App Dev</p>
              <p className="work-title">Websites &amp; application builds</p>
              <p className="work-meta">
                Custom websites and web apps built with modern front-end tools—designed
                for performance, accessibility and real-world use.
              </p>
            </div>

            <div className="work-card work-card--blue services-card">
              <p className="work-tag">Social Media + Graphics</p>
              <p className="work-title">End-to-end management + standout visuals</p>
              <p className="work-meta">
                Monthly content strategy, posting, 
                and cohesive feeds, carousels, and reels—designed with intention 
                and aligned to your brand.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* =======================
          5. ABOUT / FOUNDER
      ======================== */}
      <section id="about" className="hero hero-about-band" aria-labelledby="about-heading">
        <div className="wrapper hero-about-inner">
          <div className="sr">
            <p className="hero-tag">From Prairie View to product design</p>
            <h2 id="about-heading" className="hero-title">
              From classroom projects to{" "}
              <span className="hero-highlight">
                client work that actually works
              </span>
              .
            </h2>
            <p className="hero-text">
              I&apos;m Lauren Burrell—designer, developer, and storyteller. I
              mix my background in UX, front-end, and visual/brand design to
              help brands look good and actually work for the people using them.
            </p>
            <p className="hero-text">
              Thrive is where Black, young &amp; creative isn&apos;t a footnote—it&apos;s
              the superpower. You don&apos;t have to choose one lane when you were
              born to build the whole highway.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a href="/contact" className="btn btn-primary">
                Meet &amp; collaborate
              </a>
            </div>
          </div>

          <div className="about-photo-card sr">
            <div className="about-photo-frame">
              <img
                src="/lauren-portrait.jpg"
                alt="Lauren Burrell portrait"
                className="about-photo-img"
              />
            </div>

            <p className="about-caption">
              Lauren Burrell · Founder &amp; Creative Director, Thrive Creative Studios
            </p>
          </div>
        </div>
      </section>

      {/* =======================
          6. CLIENT LOVE / CONTACT
      ======================== */}
      <section
        id="contact"
        className="section client-voice section-grid"
        aria-labelledby="client-love-heading"
      >
        <div className="wrapper hero-testimonial-inner sr">
          <div>
            <p className="hero-tag">Client love</p>
            <h2 id="client-love-heading" className="hero-title">
              “Your voice is the value.”
            </h2>
            <p className="hero-text">
              You don&apos;t have to copy what&apos;s trending. The way you see
              the world is what people connect with most—Thrive just helps you
              show it clearly.
            </p>
          </div>

          <div className="hero-contact-card">
            <p className="hero-text-nowhite">
              Ready to collaborate on your brand, website or next launch?
            </p>
            <a
              href="mailto:thrivecreativestudios@gmail.com?subject=Project%20Inquiry"
              className="btn btn-secondary"
            >
              Tell me about your project
            </a>
          </div>
        </div>
      </section>
      {/* =======================
          7. FOOTER
      ======================== */}
      <SiteFooter />
    </div>
  );
}
