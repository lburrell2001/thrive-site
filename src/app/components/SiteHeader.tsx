// app/components/SiteHeader.tsx
"use client";
import Link from "next/link";
import { useState } from "react";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="wrapper site-header-inner">

        {/* LOGO ONLY → links home */}
        <Link
          href="/"
          className="logo-lockup"
          aria-label="Thrive Creative Studios home"
        >
          <img
            src="/logo.svg"
            alt="Thrive Creative Studios"
            className="site-logo"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="nav-links" aria-label="Main navigation">
          <Link href="/services">Services</Link>
          <Link href="/work">Portfolio</Link>
          <Link href="/contact" className="btn btn-primary">
            Work with me
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className={open ? "nav-bar nav-bar--open-top" : "nav-bar"} />
          <span className={open ? "nav-bar nav-bar--open-mid" : "nav-bar"} />
          <span className={open ? "nav-bar nav-bar--open-bot" : "nav-bar"} />
        </button>
      </div>

      {/* Mobile nav drawer */}
      {open && (
        <div
          className="nav-mobile-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <nav className="nav-mobile-links">
            <Link href="/services" onClick={() => setOpen(false)}>Services</Link>
            <Link href="/work" onClick={() => setOpen(false)}>Portfolio</Link>
            <Link
              href="/contact"
              className="btn btn-primary nav-mobile-cta"
              onClick={() => setOpen(false)}
            >
              Work with me
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
