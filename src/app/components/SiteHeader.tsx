// app/components/SiteHeader.tsx
import Link from "next/link";

export default function SiteHeader() {
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

        <nav className="nav-links">
          <Link href="/services">Services</Link>
          <Link href="/work">Portfolio</Link>

          <Link href="/contact" className="btn btn-primary">
            Work with me
          </Link>
        </nav>
      </div>
    </header>
  );
}
