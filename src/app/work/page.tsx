// app/work/page.tsx
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

const WORK_PROJECTS = [
  {
    title: "SafeSpace",
    slug: "safespace",
    category: "UX · Product · 3D",
    cover: "/work/safespace-cover.jpg",
    span: "span-5x6",
  },
  {
    title: "BrewHaus",
    slug: "brewhaus",
    category: "Branding · Packaging",
    cover: "/work/brewhaus-cover.jpg",
    span: "span-4x4",
  },
  {
    title: "TCKT",
    slug: "tckt",
    category: "Product UX · UI",
    cover: "/work/tckt-cover.jpg",
    span: "span-4x3",
  },
  {
    title: "DJ Mastamind",
    slug: "dj-mastamind",
    category: "Branding · Music",
    cover: "/work/dj-mastamind-cover.jpg",
    span: "span-3x3",
  },
  {
    title: "The Squeeze Shop",
    slug: "the-squeeze-shop",
    category: "Branding · Illustration",
    cover: "/work/squeeze-shop-cover.jpg",
    span: "span-3x3",
  },
  {
    title: "SoulCheck",
    slug: "soulcheck",
    category: "Product UX · UI",
    cover: "/work/soulcheck-cover.jpg",
    span: "span-5x4",
  },
  
];

export default function WorkPage() {
  return (
    <div className="page">
      <SiteHeader />

      <main>
        <section className="work-hero">
          <div className="wrapper">
            <p className="hero-tag">Selected work</p>
            <h1 className="hero-title">Projects that feel like a gallery wall.</h1>
            <p className="hero-text">
              A curated selection spanning branding, UX, product concepts, and content.
            </p>
          </div>
        </section>

        <section className="work-wall" aria-label="Work gallery wall">
          <div className="wrapper">
            <div className="wall-frame">
              <div className="mosaic-grid">
                {WORK_PROJECTS.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/work/${p.slug}`}
                    className={`mosaic-item ${p.span}`}
                    aria-label={`View ${p.title} project`}
                  >
                    <img src={p.cover} alt={`${p.title} cover`} className="mosaic-img" />
                    <div className="mosaic-label">
                      <span className="mosaic-kicker">{p.category}</span>
                      <span className="mosaic-title">{p.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
