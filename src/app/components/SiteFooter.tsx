import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <>
      <style>{`
        .nf {
          position: relative; overflow: hidden;
          background: #0a0a0a; color: #fff;
          font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
        }
        .nf-pattern {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
        }
        .nf-pattern img { width: 100%; height: 100%; object-fit: cover; opacity: 0.06; }
        .nf-inner { position: relative; z-index: 1; }

        /* 3-col info bar */
        .nf-top {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 40px; padding: 64px 64px 48px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nf-col-label {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,.4); margin-bottom: 14px;
        }
        .nf-col-text { font-size: 14px; line-height: 1.9; color: rgba(255,255,255,.7); }
        .nf-col-text a { color: rgba(255,255,255,.7); text-decoration: none; }
        .nf-col-text a:hover { color: #fff; }

        /* Newsletter */
        .nf-subscribe { display: flex; gap: 0; margin-top: 4px; }
        .nf-subscribe input {
          flex: 1; min-width: 0;
          background: #fff; border: 1px solid #fff;
          border-right: none; border-radius: 8px 0 0 8px;
          padding: 10px 14px; font-size: 13px; color: #0a0a0a; outline: none;
          font-family: var(--font-bai, sans-serif);
        }
        .nf-subscribe input::placeholder { color: #999; }
        .nf-subscribe button {
          background: #e50586; border: none; border-radius: 0 8px 8px 0;
          padding: 10px 16px; font-family: var(--font-bungee, sans-serif);
          font-size: 11px; letter-spacing: 0.04em; color: #fff; cursor: pointer;
          white-space: nowrap; transition: opacity .15s;
        }
        .nf-subscribe button:hover { opacity: .85; }

        /* Brand block */
        .nf-brand {
          padding: 56px 64px 48px;
          display: flex; flex-direction: column; align-items: center;
          gap: 20px; text-align: center;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nf-brand-logo { height: 36px; width: auto; display: block; filter: brightness(0) invert(1); }
        .nf-tagline {
          font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,.4);
        }
        .nf-socials { display: flex; gap: 16px; align-items: center; }
        .nf-social-icon {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.2);
          transition: border-color .15s;
        }
        .nf-social-icon:hover { border-color: rgba(255,255,255,.6); }
        .nf-social-icon svg path, .nf-social-icon svg rect,
        .nf-social-icon svg circle, .nf-social-icon svg line {
          stroke: rgba(255,255,255,.7) !important;
        }
        .nf-social-icon svg [fill="#000"] { fill: rgba(255,255,255,.7) !important; }
        .nf-nav { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .nf-navlink {
          font-family: var(--font-bungee, sans-serif);
          font-size: 12px; letter-spacing: -0.01em;
          padding: 6px 14px; border-radius: 999px;
          text-decoration: none; color: #000;
          transition: opacity .15s;
        }
        .nf-navlink:hover { opacity: .8; }
        .nf-nl-green  { background: #0cf574; }
        .nf-nl-orange { background: #fd6100; color: #fff; }
        .nf-nl-pink   { background: #e50586; color: #fff; }
        .nf-nl-blue   { background: #1e3ade; color: #fff; }

        /* Bottom bar */
        .nf-bottom {
          padding: 20px 64px; position: relative;
          font-size: 12px; color: rgba(255,255,255,.3);
          display: flex; align-items: center; justify-content: center;
        }
        .nf-admin {
          position: absolute; right: 64px; top: 50%; transform: translateY(-50%);
          font-size: 11px; color: rgba(255,255,255,.2); text-decoration: none;
        }

        @media (max-width: 900px) {
          .nf-top { grid-template-columns: 1fr 1fr; padding: 48px 32px 36px; }
          .nf-brand { padding: 48px 32px 40px; }
          .nf-bottom { padding: 20px 32px; }
        }
        @media (max-width: 600px) {
          .nf-top { grid-template-columns: 1fr; padding: 40px 24px 32px; }
          .nf-brand { padding: 40px 24px 36px; }
          .nf-bottom { padding: 18px 24px; flex-direction: column; gap: 8px; text-align: center; }
          .nf-admin { position: static; transform: none; }
        }
      `}</style>

      <footer className="nf">
        {/* Pattern watermark */}
        <div className="nf-pattern">
          <img src="/new-thrive/pattern.png" alt="" />
        </div>

        <div className="nf-inner">
          {/* 3-col info bar */}
          <div className="nf-top">
            <div>
              <div className="nf-col-label">Contact</div>
              <div className="nf-col-text">
                <a href="mailto:hello@thrivecreativestudios.org">hello@thrivecreativestudios.org</a><br />
                Dallas, TX
              </div>
            </div>
            <div>
              <div className="nf-col-label">Quick Links</div>
              <div className="nf-col-text">
                <Link href="/services">Services</Link><br />
                <Link href="/portfolio">Portfolio</Link><br />
                <Link href="/contact">Contact</Link><br />
                <Link href="/portal/login">Client Portal</Link>
              </div>
            </div>
            <div>
              <div className="nf-col-label">Stay in the Loop</div>
              <div className="nf-subscribe">
                <input type="email" placeholder="Your email address" />
                <button type="button">SUBSCRIBE →</button>
              </div>
            </div>
          </div>

          {/* Brand block */}
          <div className="nf-brand">
            <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" className="nf-brand-logo" />
            <span className="nf-tagline">Representation · Artistry · Excellence</span>

            <div className="nf-socials">
              <a href="https://www.instagram.com/thrivecreativestudio_/" target="_blank" rel="noreferrer" className="nf-social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/thrive-creative-studios" target="_blank" rel="noreferrer" className="nf-social-icon" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              </a>
            </div>

            <nav className="nf-nav" aria-label="Footer navigation">
              <Link href="/services"     className="nf-navlink nf-nl-green">SERVICES</Link>
              <Link href="/portfolio"         className="nf-navlink nf-nl-orange">PORTFOLIO</Link>
              <Link href="/contact"      className="nf-navlink nf-nl-pink">CONTACT</Link>
              <Link href="/portal/login" className="nf-navlink nf-nl-blue">CLIENT PORTAL</Link>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="nf-bottom">
            © {year} Thrive Creative Studios &nbsp;·&nbsp; Black-Owned &nbsp;·&nbsp; Black-Led &nbsp;·&nbsp; Built Different &nbsp;·&nbsp; Dallas, TX
            <a href="/admin" className="nf-admin">Admin</a>
          </div>
        </div>
      </footer>
    </>
  );
}
