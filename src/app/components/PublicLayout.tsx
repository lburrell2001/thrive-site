"use client";

import { useState, useEffect } from "react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [navScrolled, setNavScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        /* ── NAV ── */
        .pl-nav {
          position: sticky;
          top: 0;
          z-index: 300;
          background: #fff;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 48px;
          box-sizing: border-box;
          transition: box-shadow 0.25s ease;
        }
        .pl-nav-scrolled {
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .pl-nav-logo { height: 64px; width: auto; display: block; }
        .pl-nav-pills { display: flex; gap: 12px; align-items: center; }
        .pl-npill {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 18px;
          letter-spacing: -0.01em;
          padding: 12px 20px;
          border-radius: 10px;
          text-decoration: none;
          display: inline-block;
          transition: opacity .15s, transform .12s;
        }
        .pl-npill:hover { opacity: .82; transform: scale(1.04); }
        .pl-npill-green  { background: #0cf574; color: #000; }
        .pl-npill-orange { background: #fd6100; color: #000; }
        .pl-npill-pink   { background: #e50586; color: #fff; }
        .pl-npill-blue   { background: #1e3ade; color: #fff; }
        .pl-ham {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          line-height: 0;
        }
        .pl-drawer {
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 299;
          background: #fff;
          display: flex;
          flex-direction: column;
          padding: 36px 32px;
          gap: 4px;
        }
        .pl-drawer a {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 28px;
          letter-spacing: -0.03em;
          color: #000;
          text-decoration: none;
          padding: 10px 0;
          border-bottom: 1px solid rgba(0,0,0,.08);
          display: block;
        }
        .pl-drawer a.pl-drawer-portal { color: #e50586; }

        /* ── FOOTER ── */
        .pl-footer {
          background: #fff;
          position: relative;
          overflow: hidden;
        }
        .pl-footer-pattern {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
        }
        .pl-footer-pattern img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.06;
        }
        .pl-footer-top {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 40px;
          padding: 56px 80px 48px;
          box-sizing: border-box;
        }
        .pl-footer-col-label {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 12px;
          letter-spacing: 2px;
          color: #808080;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .pl-footer-col-text {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 14px;
          line-height: 1.9;
          color: #0a0a0a;
        }
        .pl-footer-col-text a {
          color: inherit;
          text-decoration: none;
        }
        .pl-footer-col-text a:hover { text-decoration: underline; }
        .pl-footer-subscribe {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .pl-footer-subscribe input {
          flex: 1;
          min-width: 140px;
          border: 2px solid #000;
          border-radius: 6px;
          padding: 10px 14px;
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 13px;
          outline: none;
        }
        .pl-footer-subscribe button {
          background: #000;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 10px 18px;
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .pl-footer-subscribe button:hover { opacity: 0.85; }

        .pl-footer-brand {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 48px 80px;
          box-sizing: border-box;
          border-top: 1px solid rgba(0,0,0,0.07);
        }
        .pl-footer-logo-img {
          height: clamp(36px, 5vw, 64px);
          width: auto;
          display: block;
          margin: 0 auto 12px;
        }
        .pl-footer-tagline {
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #808080;
          display: block;
          margin-bottom: 20px;
        }
        .pl-footer-socials {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .pl-social-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,0.15);
          transition: border-color .15s, transform .12s;
          text-decoration: none;
        }
        .pl-social-icon:hover { border-color: #000; transform: scale(1.1); }
        .pl-footer-nav {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .pl-footer-nav-link {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 14px;
          padding: 10px 18px;
          border-radius: 10px;
          text-decoration: none;
          display: inline-block;
          transition: opacity .15s, transform .12s;
        }
        .pl-footer-nav-link:hover { opacity: .82; transform: scale(1.04); }
        .pl-fn-green  { background: #0cf574; color: #000; }
        .pl-fn-orange { background: #fd6100; color: #000; }
        .pl-fn-pink   { background: #e50586; color: #fff; }
        .pl-fn-blue   { background: #1e3ade; color: #fff; }

        .pl-footer-bottom {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 16px 80px;
          border-top: 1px solid rgba(0,0,0,0.07);
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
          font-size: 12px;
          color: rgba(0,0,0,.3);
          box-sizing: border-box;
        }
        .pl-footer-admin {
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.4;
          font-size: 0.7rem;
          color: inherit;
          text-decoration: none;
        }

        /* ── MOBILE ── */
        @media (max-width: 767px) {
          .pl-nav { height: 64px; padding: 0 20px; }
          .pl-nav-logo { height: 40px; }
          .pl-nav-pills { display: none; }
          .pl-ham { display: block; }

          .pl-footer-top {
            grid-template-columns: 1fr;
            padding: 40px 24px 32px;
          }
          .pl-footer-brand { padding: 32px 24px; }
          .pl-footer-bottom { padding: 14px 24px; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className={`pl-nav${navScrolled ? " pl-nav-scrolled" : ""}`}>
        <a href="/">
          <img
            src="/new-thrive/logo-mark-blk.svg"
            alt="Thrive Creative Studios"
            className="pl-nav-logo"
          />
        </a>
        <div className="pl-nav-pills">
          <a href="/about"     className="pl-npill" style={{ background: '#5b2d8e', color: '#fff' }}>ABOUT</a>
          <a href="/services"  className="pl-npill pl-npill-green">SERVICES</a>
          <a href="/portfolio" className="pl-npill pl-npill-orange">PORTFOLIO</a>
          <a href="/contact"   className="pl-npill pl-npill-pink">CONTACT</a>
        </div>
        <button
          className="pl-ham"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            {drawerOpen ? (
              <>
                <line x1="4" y1="4" x2="22" y2="22" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="22" y1="4" x2="4"  y2="22" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
              </>
            ) : (
              <>
                <line x1="3" y1="7"  x2="23" y2="7"  stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="3" y1="13" x2="23" y2="13" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="3" y1="19" x2="23" y2="19" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {drawerOpen && (
        <div className="pl-drawer" role="dialog" aria-modal="true">
          <a href="/about"       onClick={() => setDrawerOpen(false)} style={{ color: '#5b2d8e' }}>ABOUT</a>
          <a href="/services"    onClick={() => setDrawerOpen(false)}>SERVICES</a>
          <a href="/portfolio"   onClick={() => setDrawerOpen(false)}>PORTFOLIO</a>
          <a href="/contact"     onClick={() => setDrawerOpen(false)}>CONTACT</a>
          <a href="/portal/login" className="pl-drawer-portal" onClick={() => setDrawerOpen(false)}>CLIENT PORTAL</a>
        </div>
      )}

      {/* ── PAGE CONTENT ── */}
      <main>{children}</main>

      {/* ── FOOTER ── */}
      <footer className="pl-footer" id="contact">

        <div className="pl-footer-pattern">
          <img src="/new-thrive/pattern.png" alt="" />
        </div>

        {/* 3-col info bar */}
        <div className="pl-footer-top">
          <div>
            <div className="pl-footer-col-label">Contact</div>
            <div className="pl-footer-col-text">
              <a href="mailto:hello@thrivecreativestudios.org">hello@thrivecreativestudios.org</a>
              <br />
              Dallas, TX
            </div>
          </div>
          <div>
            <div className="pl-footer-col-label">Quick Links</div>
            <div className="pl-footer-col-text">
              <a href="/services">Services</a><br />
              <a href="/portfolio">Portfolio</a><br />
              <a href="/about">About</a><br />
              <a href="/contact">Contact</a><br />
              <a href="/portal/login">Client Portal</a>
            </div>
          </div>
          <div>
            <div className="pl-footer-col-label">Stay in the Loop</div>
            <div className="pl-footer-subscribe">
              <input type="email" placeholder="Your email address" />
              <button type="button">SUBSCRIBE →</button>
            </div>
          </div>
        </div>

        {/* Brand block */}
        <div className="pl-footer-brand">
          <img
            src="/new-thrive/logo.svg"
            alt="Thrive Creative Studios"
            className="pl-footer-logo-img"
          />
          <span className="pl-footer-tagline">Representation · Artistry · Excellence</span>

          <div className="pl-footer-socials">
            <a href="https://instagram.com/thrivecreativestudio_" className="pl-social-icon" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="#000" stroke="none"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/thrivecreativestudios" className="pl-social-icon" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="#000" width="18" height="18">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
          </div>

          <div className="pl-footer-nav">
            <a href="/services"     className="pl-footer-nav-link pl-fn-green">SERVICES</a>
            <a href="/portfolio"    className="pl-footer-nav-link pl-fn-orange">PORTFOLIO</a>
            <a href="/contact"      className="pl-footer-nav-link pl-fn-pink">CONTACT</a>
            <a href="/portal/login" className="pl-footer-nav-link pl-fn-blue">CLIENT PORTAL</a>
          </div>
        </div>

        <div className="pl-footer-bottom">
          © {year} Thrive Creative Studios &nbsp;·&nbsp; Black-Owned &nbsp;·&nbsp; Black-Led &nbsp;·&nbsp; Built Different &nbsp;·&nbsp; Dallas, TX
          <a href="/admin" className="pl-footer-admin">Admin</a>
        </div>

      </footer>
    </>
  );
}
