"use client";

import { useEffect, useState } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import styles from "./newhomepage.module.css";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
  display: "swap",
});

const baiJamjuree = Bai_Jamjuree({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-bai",
  display: "swap",
});

const SERVICES = [
  {
    tag: "01 — Digital", name: "DIGITAL DESIGN", sub: "ALL YOURS IN ONLY 2–4 WEEKS",
    desc: "Web design, landing pages, and digital assets built from the ground up — infused with strategy and a visual identity that sets you apart.",
  },
  {
    tag: "02 — Social", name: "SOCIAL MEDIA", sub: "CONTENT THAT ACTUALLY CONVERTS",
    desc: "Strategy, content creation, and community management that grows your audience and turns followers into loyal clients.",
  },
  {
    tag: "03 — UX", name: "UX DESIGN", sub: "EXPERIENCES PEOPLE ACTUALLY LOVE",
    desc: "Human-centered product design that makes digital experiences feel effortless and intuitive — from wireframes to polished prototypes.",
  },
  {
    tag: "04 — Brand", name: "BRAND DESIGN", sub: "ALL YOURS IN ONLY 4–6 WEEKS",
    desc: "Complete visual identities — logos, color systems, typography, and brand guidelines — built from the ground up to set you apart in your industry.",
  },
  {
    tag: "05 — Photo", name: "PHOTOGRAPHY", sub: "VISUALS THAT TELL YOUR STORY",
    desc: "Brand photography and visual storytelling that captures real culture, real beauty, and real depth — bold, intentional, unforgettable.",
  },
];

export default function NewHomePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let raf: number;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setNavScrolled(y > 40);

        // Hero parallax — scroll-based (drift as you scroll away)
        document.querySelectorAll<HTMLElement>("[data-py]").forEach((el) => {
          const speed = parseFloat(el.dataset.py || "0");
          el.style.transform = `translateY(${y * speed}px)`;
        });
        document.querySelectorAll<HTMLElement>("[data-hx]").forEach((el) => {
          const speed = parseFloat(el.dataset.hx || "0");
          el.style.transform = `translateX(${y * speed}px)`;
        });
        // Glide-in parallax — viewport-relative (elements slide in as section enters view)
        document.querySelectorAll<HTMLElement>("[data-px]").forEach((el) => {
          const speed = parseFloat(el.dataset.px || "0");
          const rect = el.getBoundingClientRect();
          const centerOffset = (rect.top + rect.height / 2) - window.innerHeight / 2;
          el.style.transform = `translateX(${centerOffset * speed}px)`;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className={`${bungee.variable} ${baiJamjuree.variable} ${styles.page}`}>

      {/* ── NAV ── */}
      <nav className={`${styles.nav} ${navScrolled ? styles.navScrolled : ""}`}>
        <a href="/">
          <img src="/new-thrive/logo-mark-blk.svg" alt="Thrive" className={styles.navLogo} />
        </a>
        <div className={styles.navPills}>
          <a href="#services"  className={`${styles.npill} ${styles.npillGreen}`}>SERVICES</a>
          <a href="#portfolio" className={`${styles.npill} ${styles.npillOrange}`}>PORTFOLIO</a>
          <a href="#contact"   className={`${styles.npill} ${styles.npillPink}`}>CONTACT</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <span className={`${styles.gh} ${styles.ghA}`}        data-hx="-0.08">A</span>
        <span className={`${styles.gh} ${styles.ghFull}`}     data-py="0.12">FULL</span>
        <span className={`${styles.gh} ${styles.ghService}`}  data-hx="0.10">SERVICE</span>
        <span className={`${styles.gh} ${styles.ghCreative}`} data-hx="-0.06">CREATIVE</span>
        <span className={`${styles.gh} ${styles.ghAgency}`}   data-hx="0.08">AGENCY</span>
        <div className={styles.heroWordmark}>
          <img src="/new-thrive/logo.svg" alt="Thrive" className={styles.heroThrive} />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className={styles.about} id="about">
        <div className={styles.aboutFrameWrap}>
          <div className={`${styles.aboutFrame} reveal`}>
            <div className={styles.aboutFrameDiag} />
            <span className={styles.aboutFrameLabel}>Add Your Image Here</span>
          </div>
          <div className={styles.aboutBadge}>
            WE ARE<br />
            <img src="/new-thrive/logo.svg" alt="Thrive" className={styles.badgeLogo} />
          </div>
        </div>
        <div className="reveal d2" style={{ paddingTop: "10px" }}>
          <h2 className={styles.aboutH}>We do <em>almost</em> <u>everything</u></h2>
          <p className={styles.aboutP}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.</p>
          <p className={styles.aboutP}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.</p>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className={styles.services} id="services">

        <div>
          <h2 className={`${styles.servicesTitle} reveal`}><em>Take a peek at</em><br />OUR SERVICES</h2>
          <p className={`${styles.servicesDesc} reveal`} style={{ transitionDelay: "0.1s" }}>Whether you need a quick turnaround brand identity or the whole dream creative experience, I&apos;ll build you something that&apos;s bold, strategic, and fun to show off. Your brand won&apos;t just look good — it&apos;ll get you booked.</p>
        </div>

        <div className={styles.svcTabs} role="tablist">
          {["DIGITAL DESIGN", "SOCIAL MEDIA", "UX DESIGN", "BRAND DESIGN", "PHOTOGRAPHY"].map((label, i) => (
            <div
              key={i}
              className={`${styles.svcTab} ${activeTab === i ? styles.svcTabActive : ""}`}
              style={{ animationDelay: `${i * 0.07}s` }}
              data-idx={i}
              role="tab"
              tabIndex={0}
              onClick={() => setActiveTab(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(i); }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className={styles.svcPanelWrap}>
          {SERVICES.map((svc, i) => (
            <div
              key={i}
              className={`${styles.svcPanel} ${activeTab === i ? styles.svcPanelActive : ""}`}
              data-panel={i}
              role="tabpanel"
            >
              <div className={styles.svcPanelLeft}>
                <div>
                  <div className={styles.svcPanelTag}>{svc.tag}</div>
                  <div className={styles.svcPanelName}>{svc.name}</div>
                  <div className={styles.svcPanelSub}>{svc.sub}</div>
                  <p className={styles.svcPanelDesc}>{svc.desc}</p>
                </div>
                <a href="#contact" className={styles.svcPanelBtn}>GIMME THE DETAILS →</a>
              </div>
              <div className={styles.svcPanelRight}>
                
              </div>
            </div>
          ))}
        </div>

       
      </section>

      {/* ── PROCESS ── */}
      <section className={styles.process} id="process">
        <div className={`${styles.processCards} reveal`}>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>01</div>
            <p className={styles.pcardText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>02</div>
            <p className={styles.pcardText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>03</div>
            <p className={styles.pcardText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas.</p>
          </div>
          <div className={styles.pcard}>
            <div className={styles.pcardNum}>04</div>
            <p className={styles.pcardText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas.</p>
          </div>
        </div>
        <div className={`${styles.processGhost} reveal`} data-px="-0.4">THE PROCESS</div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={styles.testimonials} id="testimonials">
        <div className={styles.testiCircles}>
          <div className={`${styles.tcircle} ${styles.tc1} reveal d1`}>
            <p className={styles.tcircleText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor.</p>
            <span className={styles.tcircleClient}>DJ Mastamind</span>
          </div>
          <div className={`${styles.tcircle} ${styles.tc2} reveal d2`}>
            <p className={styles.tcircleText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor.</p>
            <span className={styles.tcircleClient}>Classic Rollers</span>
          </div>
          <div className={`${styles.tcircle} ${styles.tc3} reveal d3`}>
            <p className={styles.tcircleText}>Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. Tempus leo eu aenean sed diam urna tempor.</p>
            <span className={styles.tcircleClient}>The Burrell Group</span>
          </div>
        </div>
        <div className={`${styles.testiGhost} reveal`} data-px="0.4">OUR CLIENTS SAY</div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className={styles.ctaBanner}>
        <span className={styles.ctaBannerText}>Ready to build with us?</span>
        <a href="/contact" className={styles.ctaBannerBtn}>LET&apos;S TALK →</a>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.siteFooter} id="contact">

        {/* Pattern watermark */}
        <div className={styles.footerPatternBg}>
          <img src="/new-thrive/pattern.png" alt="" />
        </div>

        

        {/* 3-col info bar */}
        <div className={styles.footerTop}>
          <div>
            <div className={styles.footerColLabel}>Contact</div>
            <div className={styles.footerColText}>
              <a href="mailto:hello@thrivecreativestudios.org">hello@thrivecreativestudios.org</a><br />
              Dallas, TX
            </div>
          </div>
          <div>
            <div className={styles.footerColLabel}>Quick Links</div>
            <div className={styles.footerColText}>
              <a href="#services">Services</a><br />
              <a href="#portfolio">Portfolio</a><br />
              <a href="#process">Process</a><br />
              <a href="#testimonials">Client Love</a>
            </div>
          </div>
          <div>
            <div className={styles.footerColLabel}>Stay in the Loop</div>
            <div className={styles.footerSubscribe}>
              <input type="email" placeholder="Your email address" />
              <button type="button">SUBSCRIBE →</button>
            </div>
          </div>
        </div>

        {/* Brand block */}
        <div className={styles.footerBrand}>
          <div className={styles.footerLogoRow}>
            <img src="/new-thrive/logo.svg" alt="Thrive Creative Studios" className={styles.footerThriveText} />
          </div>
          <span className={styles.footerTagline}>Representation · Artistry · Excellence</span>

          <div className={styles.footerSocials}>
            <a href="#" className={styles.socialIcon} aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="#000" stroke="none"/>
              </svg>
            </a>
            <a href="#" className={styles.socialIcon} aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="#000" width="18" height="18">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
          </div>

          <div className={styles.footerNav}>
            <a href="#services"  className={`${styles.footerNavLink} ${styles.fnGreen}`}>SERVICES</a>
            <a href="#portfolio" className={`${styles.footerNavLink} ${styles.fnOrange}`}>PORTFOLIO</a>
            <a href="#contact"   className={`${styles.footerNavLink} ${styles.fnPink}`}>CONTACT</a>
          </div>
        </div>

        <div className={styles.footerBottom}>
          © 2025 Thrive Creative Studios &nbsp;·&nbsp; Black-Owned &nbsp;·&nbsp; Black-Led &nbsp;·&nbsp; Built Different &nbsp;·&nbsp; Dallas, TX
        </div>

      </footer>

    </div>
  );
}
