// app/components/SiteHeader.tsx
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrapper site-header-inner">
        <div className="logo-lockup">
          <span className="logo-mark" />
          <span>Thrive Creative Studios</span>
        </div>

        <nav className="nav-links">
          <Link href="/#services">Services</Link>
          <Link href="/#about">About</Link>
          <Link href="/work">Portfolio</Link>

          {/* INTERNAL link to contact section */}
          <Link href="/#contact" className="btn btn-primary">
            Work with me
          </Link>
        </nav>
      </div>
    </header>
  );
}
