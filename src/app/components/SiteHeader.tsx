"use client";
import Link from "next/link";
import { useState } from "react";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        .nh {
          position: sticky; top: 0; z-index: 200;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 80px;
          background: #fff; border-bottom: 1px solid #000;
          box-sizing: border-box;
        }
        .nh-logo { height: 40px; width: auto; display: block; }
        .nh-pills { display: flex; gap: 10px; align-items: center; }
        .nh-pill {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 14px; letter-spacing: -0.02em;
          padding: 9px 18px; border-radius: 10px;
          text-decoration: none; color: #000;
          transition: opacity .15s, transform .12s;
          display: inline-block;
        }
        .nh-pill:hover { opacity: .82; transform: scale(1.04); }
        .nh-green  { background: #0cf574; }
        .nh-orange { background: #fd6100; color: #fff; }
        .nh-pink   { background: #e50586; color: #fff; }
        .nh-ham {
          display: none; background: none; border: none;
          cursor: pointer; padding: 6px; line-height: 0;
        }
        .nh-drawer {
          position: fixed; top: 80px; left: 0; right: 0; bottom: 0;
          z-index: 199; background: #fff;
          border-top: 1px solid #000;
          display: flex; flex-direction: column;
          padding: 36px 32px; gap: 4px;
        }
        .nh-drawer a {
          font-family: var(--font-bungee, 'Bungee', sans-serif);
          font-size: 28px; letter-spacing: -0.03em;
          color: #000; text-decoration: none;
          padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,.08);
          display: block;
        }
        @media (max-width: 767px) {
          .nh { padding: 0 20px; height: 64px; }
          .nh-logo { height: 32px; }
          .nh-pills { display: none; }
          .nh-ham { display: block; }
          .nh-drawer { top: 64px; }
        }
      `}</style>

      <header className="nh">
        <Link href="/">
          <img
            src="/new-thrive/logo-mark-blk.svg"
            alt="Thrive Creative Studios"
            className="nh-logo"
          />
        </Link>

        <nav className="nh-pills">
          <Link href="/about"     className="nh-pill" style={{ background: '#5b2d8e', color: '#fff' }}>ABOUT</Link>
          <Link href="/services"  className="nh-pill nh-green">SERVICES</Link>
          <Link href="/portfolio" className="nh-pill nh-orange">PORTFOLIO</Link>
          <Link href="/contact"   className="nh-pill nh-pink">CONTACT</Link>
        </nav>

        <button
          className="nh-ham"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            {open ? (
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
      </header>

      {open && (
        <div className="nh-drawer" role="dialog" aria-modal="true">
          <Link href="/about"     onClick={() => setOpen(false)} style={{ color: '#5b2d8e' }}>ABOUT</Link>
          <Link href="/services"  onClick={() => setOpen(false)}>SERVICES</Link>
          <Link href="/portfolio" onClick={() => setOpen(false)}>PORTFOLIO</Link>
          <Link href="/contact"   onClick={() => setOpen(false)}>CONTACT</Link>
          <Link href="/portal/login" onClick={() => setOpen(false)} style={{ color: '#e50586' }}>CLIENT PORTAL</Link>
        </div>
      )}
    </>
  );
}
