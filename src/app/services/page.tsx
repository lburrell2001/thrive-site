import { Bungee, Bai_Jamjuree } from "next/font/google";
import PublicLayout from "../components/PublicLayout";
import WorkReel from "../components/WorkReel";
import PhotoSticker from "../components/PhotoSticker";
import { TapeStrip, ClosingCta } from "../newhomepage/HomeSections";
import { SHOWCASE } from "@/lib/serviceShowcase";
import { SERVICE_PRICING } from "@/lib/servicePricing";
import { storageUrl } from "@/lib/storage";
import s from "./ServicesPage.module.css";

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

const WHY = [
  { title: "Rooted in Representation", text: "We build brands that reflect the full richness of culture — not just what's easy or expected.", tone: s.pink },
  { title: "Strategy First", text: "Every visual decision is backed by real brand strategy — no guessing, no generic templates.", tone: s.orange },
  { title: "Full-Service Studio", text: "From logo to launch — branding, web, social, photography, all under one roof.", tone: s.green },
];

/** The first price list on each service page, minus add-ons: "Starter $750", … */
function packagesFor(slug: keyof typeof SERVICE_PRICING) {
  return (SERVICE_PRICING[slug].sections[0]?.cards ?? [])
    .filter((c) => !c.name.startsWith("Add-on"))
    .slice(0, 4);
}

export default function ServicesPage() {
  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable} ${s.page}`}>

        {/* ── HERO ── */}
        <section className={s.hero}>
          <div className={s.heroText}>
            <h1 className={s.h1}>
              Everything your brand <span className={s.accent}>needs</span>
            </h1>
            <p className={s.lede}>
              From a quick-turnaround brand identity to the whole dream creative experience, we build work that&apos;s
              bold, strategic, and fun to show off — and that gets you booked.
            </p>
            <p className={s.where}>In person across DFW, remote across the US.</p>
            <a href="/contact" className={s.heroBtn}>Start a project →</a>
          </div>

          <nav className={s.cluster} aria-label="Jump to a service">
            <span className={s.clusterHint} aria-hidden>Tap a sticker to jump to it</span>
            {SHOWCASE.map((svc, i) => (
              <a key={svc.slug} href={`#${svc.slug}`} aria-label={svc.title} className={`${s.sticker} ${s[`spot${i}`]}`}>
                <PhotoSticker name={svc.title} img={svc.sticker} tone={svc.tone} id={`svc-ring-${svc.slug}`} />
              </a>
            ))}
          </nav>
        </section>

        <TapeStrip />

        {/* ── ONE SECTION PER SERVICE ── */}
        {SHOWCASE.map((svc, i) => {
          const pricing = SERVICE_PRICING[svc.slug];
          const num = String(i + 1).padStart(2, "0");
          return (
            <section key={svc.slug} id={svc.slug} className={`${s.chapter} ${s[svc.tone]} ${i % 2 ? s.flip : ""}`}>
              <span className={s.ghostNum} aria-hidden>{num}</span>

              <a href={svc.href} className={s.media} tabIndex={-1} aria-hidden>
                {svc.media.type === "video" ? (
                  <video autoPlay muted loop playsInline preload="metadata" poster={svc.media.poster}>
                    <source src={storageUrl(`videos/${svc.media.src}`)} type="video/mp4" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={svc.media.local ? svc.media.src : storageUrl(svc.media.src)} alt="" loading="lazy" />
                )}
                <span className={s.num}>{num}</span>
              </a>

              <div className={s.body}>
                <h2 className={s.name}>{svc.name}</h2>
                <span className={s.price}>{pricing.from}</span>
                <p className={s.desc}>{svc.desc}</p>
                <ul className={s.chips}>
                  {packagesFor(svc.slug).map((c) => (
                    <li key={c.name}>
                      {c.name} <b>{c.price}</b>
                    </li>
                  ))}
                </ul>
                <a href={svc.href} className={s.btn}>Packages &amp; details →</a>
              </div>
            </section>
          );
        })}

        {/* ── WHY THRIVE ── */}
        <section className={s.why}>
          <h2 className={s.sectionH}>Why Thrive?</h2>
          <div className={s.whyGrid}>
            {WHY.map((w) => (
              <div key={w.title} className={`${s.whyCard} ${w.tone}`}>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </section>

        <WorkReel title="See it in action" tone="dark" />
        <ClosingCta />
      </div>
    </PublicLayout>
  );
}
