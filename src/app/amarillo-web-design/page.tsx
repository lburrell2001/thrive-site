import type { Metadata } from "next";
import Link from "next/link";
import PublicLayout from "../components/PublicLayout";
import { ClosingCta } from "../newhomepage/HomeSections";
import { SERVICE_PRICING } from "@/lib/servicePricing";
import { WORK_PHOTOS, type WorkPhoto } from "@/lib/workPhotos";
import HometownStory from "./HometownStory";
import { BUSINESS_ID, SITE_NAME, SITE_URL, absoluteUrl, buildPageMetadata, jsonLd } from "@/lib/seo";
import s from "./amarillo.module.css";

// The Amarillo hub page. Thrive is a Dallas studio; Amarillo is the founder's
// hometown, and Amarillo clients work with us remotely, in person when Lauren
// is in town. Never say we have an Amarillo office or are "located in"
// Amarillo. Keep every line true — Google and AI assistants quote it.
// Prices come from servicePricing.ts so this page can't drift from the
// service pages.

const PATH = "/amarillo-web-design";
const TITLE = "Amarillo Web Development, Branding & Social Media | Thrive Creative Studios";
const DESCRIPTION =
  "Web development, graphic design, and social media marketing for Amarillo small businesses. Starter websites from $750. Founded by an Amarillo native.";

const base = buildPageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });
export const metadata: Metadata = {
  ...base,
  // Used as written: the layout's " | Thrive Creative Studios" would double up.
  title: { absolute: TITLE },
};

const CLASSIC_ROLLERS = {
  href: "/work/classic-rollers-car-club",
  img: "/case-studies/classic-rollers-car-club/mockup-screens-1200.webp",
  alt: "The Classic Rollers Car Club website on a desktop monitor, with its Join the Club, Donate, Membership and Events sections and the phone version floating around it",
};

/**
 * Lauren's hometown story, in her words (first person): a paragraph per
 * string, shown under "Amarillo is home" and signed by her.
 */
const HOMETOWN_STORY: string[] = [
  "I grew up on the north side of Amarillo, near Ross Rogers Golf Course, and graduated from Tascosa High School. When I'm home, my first stop is still Sharky's for the kids' steak nachos with spicy ranch on the side, then Water Still for a half mint, half blueberry sweet green tea.",
  "My family is spread across Dallas and Houston, so I always had one foot in the big city. After Tascosa I went to Prairie View A&M University, earned a degree in computer science, and started my career at IBM. Living in Dallas showed me what businesses here have within reach: large agencies, graphic designers and art directors who help them look like a force.",
  "Amarillo has plenty of businesses with that same potential. What they often don't have is that team behind them, at a price that makes sense. That's why I work with Amarillo businesses through Thrive Creative Studios. My family and friends are still there, and today we support CL Percy Group and the Amarillo Alumnae Chapter of Delta Sigma Theta with social media graphics and other creative work.",
  "Projects run remotely, with calls, video and shared files, and I meet in person whenever I'm back home.",
  "If you run a business in Amarillo, you don't need a Dallas budget to look like you belong on a bigger stage. You need the right team, and one that knows where you're from.",
];


/** One real project photo beside each service heading. Alt text describes the photo only. */
const find = (list: WorkPhoto[], href: string) => list.find((p) => p.href === href)!;
const PHOTOS = {
  web: { ...find(WORK_PHOTOS["digital-design"], "/work/the-burrell-group") },
  brand: { ...find(WORK_PHOTOS["brand-design"], "/work/brewhaus") },
  social: { ...find(WORK_PHOTOS["social-media"], "/work/dallas-derby-day") },
};

function ServicePhoto({ photo }: { photo: WorkPhoto }) {
  return (
    <Link href={photo.href} className={s.servicePhoto}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.alt} width={600} height={600} loading="lazy" decoding="async" />
      <span>{photo.caption}</span>
    </Link>
  );
}

const web = SERVICE_PRICING["digital-design"].sections[0].cards;
const brand = SERVICE_PRICING["brand-design"].sections[0].cards;
const social = SERVICE_PRICING["social-media"].sections[0].cards[0];
const tier = (name: string) => web.find((c) => c.name === name)!;
const pages = (name: string) => tier(name).scope?.split(" · ")[0] ?? "";
const weeks = (name: string) => tier(name).scope?.split(" · ")[1]?.replace("Live in ", "").toLowerCase() ?? "";

const PRICES = [
  { group: "Websites", rows: [
    { name: "Starter", price: tier("Starter").price, note: pages("Starter") },
    { name: "Medium", price: tier("Medium").price, note: pages("Medium") },
    { name: "Large", price: tier("Large").price, note: `${pages("Large")}, with an admin area` },
  ], href: "/services/digital-design#pricing" },
  { group: "Brand design", rows: brand.map((c) => ({ name: c.name, price: c.price, note: c.scope ?? c.items?.[0] ?? "" })), href: "/services/brand-design#pricing" },
  { group: "Social media", rows: [{ name: "Monthly management", price: social.price.replace("/month", " a month"), note: social.scope ?? "" }], href: "/services/social-media#pricing" },
];

/** Shown on the page and sent as FAQPage schema — one list, so they always match. */
const FAQS = [
  {
    q: "How much does a website cost in Amarillo?",
    a: `With us, a small business website costs ${tier("Starter").price} to ${tier("Large").price}. Starter is ${tier("Starter").price} for ${pages("Starter")}, Medium is ${tier("Medium").price} for ${pages("Medium")}, and Large is ${tier("Large").price} for ${pages("Large")} with an admin area. Sites that need more, like logins or online payments, are quoted separately. You get a written proposal with the price before any work starts.`,
  },
  {
    q: "Do you meet with Amarillo clients in person?",
    a: "Yes, when our founder is in Amarillo. Otherwise we meet virtually, by phone or video, and the project runs the same way.",
  },
  {
    q: "Can you work on my WordPress, Wix or Squarespace site?",
    a: "Yes. We can work with your site on WordPress, Wix, Squarespace and other platforms. If your site needs more than the platform can do, we build it from scratch.",
  },
  {
    q: "How long does a website take?",
    a: `Starter sites go live in ${weeks("Starter")}, Medium sites in ${weeks("Medium")}, and Large sites in ${weeks("Large")}. Your timeline is in the proposal, agreed before we start.`,
  },
  {
    q: "You're based in Dallas. Can you work with an Amarillo business?",
    a: "Yes. Our founder is from Amarillo, and we already work with Amarillo organizations, including the Classic Rollers Car Club, CL Percy Group and the Amarillo Alumnae Chapter of Delta Sigma Theta. Projects run over calls, video and shared files.",
  },

];

export default function AmarilloPage() {
  const url = absoluteUrl(PATH);
  const city = (name: string) => ({ "@type": "City", name, containedInPlace: { "@type": "State", name: "Texas" } });
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Same business as the root layout (same @id): Dallas details only.
        "@type": "ProfessionalService",
        "@id": BUSINESS_ID,
        name: SITE_NAME,
        url: SITE_URL,
        email: "hello@thrivecreativestudios.org",
        address: { "@type": "PostalAddress", addressLocality: "Dallas", addressRegion: "TX", addressCountry: "US" },
        areaServed: [city("Amarillo"), city("Dallas")],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Amarillo", item: url },
        ],
      },
    ],
  };

  return (
    <PublicLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <div className={s.page}>
        {/* ── HERO ── */}
        <section className={s.hero}>
          <div className={s.heroText}>
            <h1 className={s.h1}>
              Web Development, Branding &amp; Social Media in <span className={s.accent}>Amarillo</span>, TX
            </h1>
            <p className={s.lead}>
              Our founder is from Amarillo, born and raised, Tascosa High School. Thrive is based in Dallas and works
              with Amarillo businesses and nonprofits.
            </p>
            <div className={s.actions}>
              <Link href="/contact" className={s.btnPrimary}>Start a project →</Link>
              <Link href="/book" className={s.btnGhost}>Book a free call</Link>
            </div>
          </div>
          <figure className={s.polaroid}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/amarillo/tascosa-graduation.webp"
              srcSet="/amarillo/tascosa-graduation-480.webp 480w, /amarillo/tascosa-graduation.webp 768w"
              sizes="(max-width: 1023px) 340px, 400px"
              width={768}
              height={1024}
              fetchPriority="high"
              alt="Our founder in a cap and gown holding a Tascosa High School diploma, with family on graduation day in Amarillo"
            />
            <figcaption>Graduation day at Tascosa High School</figcaption>
          </figure>
        </section>

        {/* ── SERVICES ── */}
        <section className={s.services}>
          <article className={`${s.service} ${s.pink}`}>
            <div className={s.serviceHead}>
              <h2 className={s.h2}>Web Development in Amarillo</h2>
              <ServicePhoto photo={PHOTOS.web} />
            </div>
            <div className={s.serviceBody}>
              <p>
                We build websites for Amarillo businesses and nonprofits. Already on WordPress, Wix, Squarespace or
                another platform? We can work with your site where it is. If it needs more than the platform can do,
                we build it from scratch.
              </p>
              <p>
                We handle the design and the build. Sites we build work on any screen and are set up for Google. Larger sites include an admin area, so
                your team can update text and photos themselves. Starter sites go live in {weeks("Starter")}. See
                packages on our <Link href="/services/digital-design">web development page</Link>.
              </p>
            </div>
          </article>

          <article className={`${s.service} ${s.orange}`}>
            <div className={s.serviceHead}>
              <h2 className={s.h2}>Graphic Design and Branding in Amarillo, TX</h2>
              <ServicePhoto photo={PHOTOS.brand} />
            </div>
            <div className={s.serviceBody}>
              <p>
                Your brand is how people remember you after they drive past your sign or scroll past your post. We
                design logos, color palettes and font pairings that work together, with files for print and web.
              </p>
              <p>
                You see two logo concepts, pick one, and we refine it together. Logo and essentials is {brand[0].price}.
                Full identity is {brand[1].price} and adds brand guidelines, social media graphics and a business card.
                More on our <Link href="/services/brand-design">brand design page</Link>.
              </p>
            </div>
          </article>

          <article className={`${s.service} ${s.green}`}>
            <div className={s.serviceHead}>
              <h2 className={s.h2}>Social Media Marketing in Amarillo</h2>
              <ServicePhoto photo={PHOTOS.social} />
            </div>
            <div className={s.serviceBody}>
              <p>
                Each month we plan your content calendar, design the graphics, edit the videos and write the captions.
                You approve every post, then we schedule and post it.
              </p>
              <p>
                Management is {social.price.replace("/month", " a month")}, depending on posts and accounts. We already
                make social media graphics for CL Percy Group and the Amarillo Alumnae Chapter of Delta Sigma Theta. See
                how it works on our <Link href="/services/social-media">social media page</Link>.
              </p>
            </div>
          </article>
        </section>

        {/* ── PRICING ── */}
        <section className={s.pricing} aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={s.h2}>Pricing</h2>
          <div className={s.priceGrid}>
            {PRICES.map((g) => (
              <div key={g.group} className={`sticker-card flat ${s.priceCard}`}>
                <h3 className={s.priceGroup}>{g.group}</h3>
                <ul className={s.priceRows}>
                  {g.rows.map((r) => (
                    <li key={r.name}>
                      <span className={s.priceName}>{r.name}</span>
                      <span className={s.priceAmt}>{r.price}</span>
                      <span className={s.priceNote}>{r.note}</span>
                    </li>
                  ))}
                </ul>
                <Link href={g.href} className={s.priceMore}>What&apos;s included →</Link>
              </div>
            ))}
          </div>
          <p className={s.priceFoot}>Every price is confirmed in a written proposal before work starts.</p>
        </section>

        {/* ── AMARILLO WORK ── */}
        <section className={s.work} aria-labelledby="work-heading">
          <h2 id="work-heading" className={s.h2}>Amarillo Work</h2>
          <div className={s.workGrid}>
            <Link href={CLASSIC_ROLLERS.href} className={s.workPrint}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CLASSIC_ROLLERS.img} width={1200} height={900} loading="lazy" alt={CLASSIC_ROLLERS.alt} />
            </Link>
            <div className={s.workBody}>
              <h3 className={s.workTitle}>Classic Rollers Car Club</h3>
              <p className={s.workP}>
                Classic Rollers has been part of Amarillo since 1985. Every event the club hosts raises money for the
                Ike Avery Scholarship Fund. We designed and built a site around the three things people come to do:
                join, give, and show up.
              </p>
              <div className={s.actions}>
                <Link href={CLASSIC_ROLLERS.href} className={s.btnPrimary}>Read the case study →</Link>
                <a href="https://classicrollersamatx.org" target="_blank" rel="noopener" className={s.btnGhostLight}>Visit the site ↗</a>
              </div>
            </div>
          </div>
          <p className={s.also}>
            We also work with <strong>CL Percy Group</strong> and the{" "}
            <strong>Amarillo Alumnae Chapter of Delta Sigma Theta</strong>.
          </p>
        </section>

        {/* ── HOMETOWN ── */}
        <section className={s.story} aria-labelledby="home-heading">
          <h2 id="home-heading" className={s.h2}>Amarillo is home</h2>
          <HometownStory paragraphs={HOMETOWN_STORY} signoff="— Lauren Burrell, founder of Thrive Creative Studios" />
        </section>

        {/* ── FAQ ── */}
        <section className={s.faq} aria-labelledby="faq-heading">
          <h2 id="faq-heading" className={s.h2}>FAQ</h2>
          <div className={s.faqList}>
            {FAQS.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary className={s.faqQ}>{f.q}</summary>
                <p className={s.faqA}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <ClosingCta />
      </div>
    </PublicLayout>
  );
}
