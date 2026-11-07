'use client';

// The site's frame on every public page: the two pills and logo up top, the
// full-screen menu of coloured panels, and the footer. Pages not redesigned
// yet render through PublicLayout with `legacy`, which keeps their own type
// (system font, normal tracking) inside the new frame.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import NewsletterSignup from '../components/NewsletterSignup';
import { rd } from './links';
import s from './redesign.module.css';

export const MENU = [
  { n: '01', label: 'Home', href: '/', tone: s.bMagenta },
  { n: '02', label: 'Work', href: '/work', tone: s.bOrange },
  { n: '03', label: 'Services', href: '/services', tone: s.bBlue },
  { n: '04', label: 'About', href: '/about', tone: s.bMint },
  { n: '05', label: 'Journal', href: '/journal', tone: s.bPurple },
  { n: '06', label: 'Contact', href: '/contact', tone: s.bBlack },
];

export default function Shell({ children, legacy = false }: { children: React.ReactNode; legacy?: boolean }) {
  const pathname = usePathname();
  const home = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The homepage hero has the big logo, so the header's logo waits until it's
  // scrolled past; every other page shows it straight away.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > (home ? window.innerHeight * 0.5 : 20));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [home]);

  // The menu owns the page while it's open, and closes on navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const showLogo = scrolled || !home;
  const year = new Date().getFullYear();

  return (
    <div className={s.page}>
      <header className={`${s.header} ${scrolled ? s.headerScrolled : ''} ${showLogo ? s.headerWithLogo : ''}`}>
        <Link href={rd('/contact')} className={s.pill}>Let’s Start a Project</Link>
        <Link href={rd('/')} className={s.headerLogo} aria-label="Thrive Creative Studios home" tabIndex={showLogo ? 0 : -1}>
          <img src="/new-thrive/logo.svg" alt="" />
        </Link>
        <button type="button" className={s.pill} aria-expanded={menuOpen} aria-controls="rd-menu" onClick={() => setMenuOpen(true)}>Menu</button>
      </header>

      {/* ── Menu: the pages as brand-colour cards, like the rest of the site ── */}
      <div id="rd-menu" className={`${s.menu} ${menuOpen ? s.menuOpen : ''}`} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!menuOpen}>
        <div className={s.menuTop}>
          <Link href={rd('/contact')} className={s.pill} onClick={() => setMenuOpen(false)}>Let’s Start a Project</Link>
          <Link href={rd('/')} className={s.menuLogo} aria-label="Thrive Creative Studios home" onClick={() => setMenuOpen(false)}>
            <img src="/new-thrive/logo.svg" alt="" />
          </Link>
          <button type="button" className={s.pill} onClick={() => setMenuOpen(false)}>Close</button>
        </div>
        <nav className={s.menuGrid} aria-label="Site">
          {MENU.map((m, i) => (
            <Link key={m.href} href={rd(m.href)} className={`${s.menuCard} ${m.tone}`} style={{ '--i': i } as React.CSSProperties} onClick={() => setMenuOpen(false)}>
              <span className={s.menuNum} aria-hidden>{m.n}</span>
              <span className={s.menuLabel}>{m.label}</span>
              <span className={s.menuArrow} aria-hidden>→</span>
            </Link>
          ))}
        </nav>
        <div className={s.menuFoot}>
          <a href="mailto:hello@thrivecreativestudios.org">hello@thrivecreativestudios.org</a>
          <a href="https://www.instagram.com/thrivecreativestudio_/" target="_blank" rel="noopener">Instagram</a>
          <Link href="/book" onClick={() => setMenuOpen(false)}>Book a call</Link>
          <Link href="/portal/login" onClick={() => setMenuOpen(false)}>Client portal</Link>
        </div>
      </div>

      {legacy ? <main className={s.legacyBody}>{children}</main> : <main>{children}</main>}

      <footer className={s.footer}>
        <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" className={s.footerLogo} />
        <div className={s.footerCols}>
          <nav aria-label="Footer">
            {MENU.map((m) => <Link key={m.href} href={rd(m.href)}>{m.label}</Link>)}
            <Link href="/portal/login">Client portal</Link>
          </nav>
          <div className={s.footerNews}>
            <p className={s.smallHead}>Join our community</p>
            <NewsletterSignup className={s.newsForm} />
          </div>
        </div>
        <div className={s.footerBottom}>
          <p className={s.footerSmall}>© {year} Thrive Creative Studios · Black-owned · Black-led · Dallas, TX · <Link href="/privacy">Privacy</Link></p>
          <a href="/admin" className={s.adminBtn}>Admin</a>
        </div>
      </footer>
    </div>
  );
}
