import type { Metadata } from "next";
import Link from "next/link";
import Shell from "../_site/Shell";
import CtaBand from "../_site/CtaBand";
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
// Exact keywords first: "Amarillo Web Design" / "Amarillo Graphic Design".
const TITLE = "Amarillo Web Design & Graphic Design | Thrive Creative Studios";
const WEB_FROM = SERVICE_PRICING["digital-design"].sections[0].cards[0].price;
const BRAND_FROM = SERVICE_PRICING["brand-design"].sections[0].cards[0].price;
const DESCRIPTION =
  `Amarillo web design and graphic design for small businesses and nonprofits: websites from ${WEB_FROM}, logos and branding from ${BRAND_FROM}, and social media management. Founded by an Amarillo native.`;

const base = buildPageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });
export const metadata: Metadata = {
  ...base,
  // Used as written: the layout's " | Thrive Creative Studios" would double up.
  title: { absolute: TITLE },
};

const CLASSIC_ROLLERS = {
  href: "/work/classic-rollers-car-club",
  img: "/case-studies/classic-rollers-car-club/mockup-screens-1200.webp",
  alt: "Amarillo web design project: the Classic Rollers Car Club website on a desktop monitor, with its Join the Club, Donate, Membership and Events sections and the phone version floating around it",
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

/** The steps of a project, from the service page's process (configs.ts). */
const PROCESS = [
  { title: "A free call", text: "We talk through your business, who you want to reach and what the website or brand needs to do. Book a time online or send a message; calls and video work the same from Amarillo as from Dallas." },
  { title: "A written proposal", text: "You get the pages or pieces, the timeline and the price in writing before any work starts, so you know exactly what you're paying for." },
  { title: "Design", text: "For a website, a page-by-page plan, then the full visual design: color, type, imagery and layout. For a brand, two logo concepts to choose from, then refinement." },
  { title: "Build", text: "Your site is built in your colors and fonts, designed for phones first and set up for Google, or your brand files are finished for print and web." },
  { title: "Launch", text: "We test on phones and desktops, then launch. Care plans keep the site secure and up to date after launch." },
];

/** Shown on the page and sent as FAQPage schema — one list, so they always match. */
const FAQS = [
  {
    q: "How much does a website cost in Amarillo?",
    a: `With us, a small business website costs ${tier("Starter").price} to ${tier("Large").price}. Starter is ${tier("Starter").price} for ${pages("Starter")}, Medium is ${tier("Medium").price} for ${pages("Medium")}, and Large is ${tier("Large").price} for ${pages("Large")} with an admin area. Sites that need more, like logins or online payments, are quoted separately. You get a written proposal with the price before any work starts.`,
  },
  {
    q: "How much does graphic design cost in Amarillo?",
    a: `Logo and essentials is ${brand[0].price} and a full brand identity is ${brand[1].price}. Single pieces start at $70 for a flyer, poster or social graphic, and an event flyer set with feed, story and print versions is $180. Every project gets a written price before work starts.`,
  },
  {
    q: "Will my new website show up on Google?",
    a: "Every site we build is set up for Google, with search groundwork built in, and every page is designed for phones first. Nobody can honestly promise a top spot on Google, but a well-built site gives you the best start.",
  },
  {
    q: "What do I need to get started?",
    a: "Just a free call. Bring what you have, like a logo, photos or a site you like, but you don't need any of it. If you don't have a brand yet, branding can be part of the same project.",
  },
  {
    q: "Do you meet with Amarillo clients in person?",
    a: "Yes, when our founder is in Amarillo. Otherwise we meet virtually, by phone or video, and the project runs the same way.",
  },
  {
    q: "Can you work on my WordPress, Wix, Squarespace or Shopify site?",
    a: "Yes. We can work with your site on WordPress, Wix, Squarespace, Shopify and other platforms. If your site needs more than the platform can do, we build it from scratch.",
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

const dollars = (p: string) => Number((p.match(/[\d,]+/)?.[0] ?? "0").replace(/,/g, ""));
const SERVICES_LD = [
  { id: "web-design", name: "Amarillo Web Design & Development", type: "Web design and development", href: "/services/digital-design", from: tier("Starter").price,
    description: "Websites for Amarillo small businesses and nonprofits: designed and built in your brand, mobile-first and set up for Google, or work on your existing WordPress, Wix, Squarespace or Shopify site." },
  { id: "graphic-design", name: "Amarillo Graphic Design & Branding", type: "Graphic design and branding", href: "/services/brand-design", from: brand[0].price,
    description: "Logos, color palettes, fonts, brand guidelines, flyers, social graphics and print pieces for Amarillo businesses." },
  { id: "social-media", name: "Social Media Marketing in Amarillo", type: "Social media management", href: "/services/social-media", from: social.price,
    description: "Monthly content calendar, designed graphics, edited video, captions, scheduling and posting, with every post approved by you." },
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
        telephone: "+1-806-414-5241",
        address: { "@type": "PostalAddress", addressLocality: "Dallas", addressRegion: "TX", addressCountry: "US" },
        areaServed: [city("Amarillo"), city("Dallas")],
      },
      ...SERVICES_LD.map((sv) => ({
        "@type": "Service",
        "@id": `${url}#${sv.id}`,
        name: sv.name,
        serviceType: sv.type,
        description: sv.description,
        provider: { "@id": BUSINESS_ID },
        areaServed: city("Amarillo"),
        url: absoluteUrl(sv.href),
        offers: { "@type": "Offer", priceCurrency: "USD", price: dollars(sv.from), description: `From ${sv.from}` },
      })),
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
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <div className={s.page}>
        {/* ── HERO ── */}
        <section className={s.hero}>
          <div className={s.heroText}>
            <h1 className={s.h1}>
              <span className={s.accent}>Amarillo</span> Web Design &amp; Graphic Design
            </h1>
            <p className={s.lead}>
              Websites, logos and branding, and social media for Amarillo businesses and nonprofits. Our founder is
              from Amarillo, born and raised, Tascosa High School. Thrive is based in Dallas and works with Amarillo
              clients remotely, and in person when she’s home.
            </p>
            <div className={s.actions}>
              <Link href="/contact" className={s.btnPrimary}>Let’s Start a Project</Link>
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
              <h2 className={s.h2}>Amarillo Web Design &amp; Development</h2>
              <ServicePhoto photo={PHOTOS.web} />
            </div>
            <div className={s.serviceBody}>
              <p>
                We build websites for Amarillo businesses and nonprofits. Already on WordPress, Wix, Squarespace, Shopify or
                another platform? We can work with your site where it is. If it needs more than the platform can do,
                we build it from scratch.
              </p>
              <p>
                We handle the design and the build. Sites we build work on any screen and are set up for Google. Larger sites include an admin area, so
                your team can update text and photos themselves. Starter sites go live in {weeks("Starter")}. See
                packages on our <Link href="/services/digital-design">web design &amp; development page</Link>.
              </p>
            </div>
          </article>

          <article className={`${s.service} ${s.orange}`}>
            <div className={s.serviceHead}>
              <h2 className={s.h2}>Amarillo Graphic Design &amp; Branding</h2>
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

        {/* ── LOCAL ── */}
        <section className={s.local} aria-labelledby="local-heading">
          <h2 id="local-heading" className={s.h2}>Web Design for How Amarillo Finds You</h2>
          <div className={s.localBody}>
            <p>
              In Amarillo, a lot of business still comes by word of mouth: a friend’s recommendation, a flyer at
              church, a post someone shared. But almost everyone looks you up before they call. They search your
              name on their phone, find your Google listing, and tap through to your website or your Instagram. If
              what they find is out of date, hard to read on a phone, or missing, many of them move on to the next
              name.
            </p>
            <p>
              Good Amarillo web design closes that gap. Your site should say what you do and who you do it for in
              the first few seconds, show your real work, and make the next step obvious, whether that’s calling,
              booking, ordering or coming by. Your graphic design should look the same everywhere people see you,
              from your sign and business cards to your social media and your homepage, so you’re easy to
              recognize and easy to trust.
            </p>
            <p>
              That’s the work we do, for Amarillo businesses and nonprofits, from a starter website to a full brand.
              You work with the same team from the first call to launch, the people who design your brand
              are the people who build your site, and every price is agreed in writing before anything starts.
            </p>
          </div>
        </section>

        {/* ── PROCESS ── */}
        <section className={s.process} aria-labelledby="process-heading">
          <h2 id="process-heading" className={s.h2}>How an Amarillo Web Design Project Works</h2>
          <ol className={s.steps}>
            {PROCESS.map((st, i) => (
              <li key={st.title} className={s.step}>
                <span className={s.stepNum}>{i + 1}</span>
                <h3 className={s.stepTitle}>{st.title}</h3>
                <p className={s.stepText}>{st.text}</p>
              </li>
            ))}
          </ol>
          <div className={s.actions}>
            <Link href="/book" className={s.btnPrimary}>Book your free call</Link>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className={s.pricing} aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={s.h2}>Amarillo Web Design &amp; Graphic Design Pricing</h2>
          <div className={s.priceGrid}>
            {PRICES.map((g) => (
              <div key={g.group} className={s.priceCard}>
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
                <Link href={CLASSIC_ROLLERS.href} className={s.btnPrimary}>Read the case study</Link>
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
          <h2 id="faq-heading" className={s.h2}>Amarillo Web Design FAQ</h2>
          <div className={s.faqList}>
            {FAQS.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary className={s.faqQ}>{f.q}</summary>
                <p className={s.faqA}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

      </div>
      <CtaBand />
    </Shell>
  );
}
