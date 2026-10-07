import type { Metadata } from "next";
import Link from "next/link";
import PublicLayout from "../components/PublicLayout";
import WorkReel from "../components/WorkReel";
import { loadReelProjects } from "@/lib/workReel";
import { BUSINESS_ID, SITE_URL, absoluteUrl, buildPageMetadata, jsonLd } from "@/lib/seo";
import s from "./amarillo.module.css";

// Web design for Amarillo businesses. Thrive is a Dallas studio, but
// Amarillo is Lauren's hometown (her story, in her words, is HOMETOWN_STORY):
// she works with Amarillo clients remotely and meets in person when she's
// back home. Keep every line here true —
// Google and AI assistants quote it.

const PATH = "/amarillo-web-design";

export const metadata: Metadata = buildPageMetadata({
  title: "Web Design for Amarillo Businesses",
  description:
    "Affordable web design, branding and social media for Amarillo, TX small businesses, from a Dallas design studio whose founder is from Amarillo. Remote, with in-person meetings when she's in town.",
  path: PATH,
  keywords: [
    "web design Amarillo",
    "Amarillo web designer",
    "website design Amarillo TX",
    "affordable web design Amarillo",
    "branding Amarillo TX",
    "social media management Amarillo",
  ],
});

const ACCENT = "#e50586";

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

const SERVICES = [
  { name: "Web Development", href: "/services/digital-design", desc: "Custom-coded websites, or sites designed and built on Wix, Shopify or Webflow — designed mobile-first, around your brand." },
  { name: "Branding", href: "/services/brand-design", desc: "A logo, colors, type and brand guidelines that make your business recognizable everywhere it shows up." },
  { name: "Social Media", href: "/services/social-media", desc: "A monthly content calendar, designed posts, edited videos and captions, scheduled and posted for you." },
  { name: "UX Design", href: "/services/ux-design", desc: "Research, wireframes and tested prototypes for apps and websites that need to be easy to use." },
];

const STEPS = [
  { title: "Intro call", desc: "A short call about your business and what you need. Book a time online — it's free." },
  { title: "Proposal", desc: "A written proposal with the scope, timeline and price, agreed before any work starts." },
  { title: "Design", desc: "Discovery, wireframes and full design, with check-ins by video — or in person when Lauren is in Amarillo." },
  { title: "Launch", desc: "Final files, assets and specs ready to launch, and a build included if your proposal covers it." },
];

const FAQS = [
  {
    q: "Do you work with businesses in Amarillo?",
    a: "Yes. Thrive is based in Dallas, but Amarillo is founder Lauren Burrell's hometown — she grew up on the north side and graduated from Tascosa High School. Thrive already creates social media graphics and other creative work for CL Percy Group and the Amarillo Alumnae Chapter of Delta Sigma Theta. Projects run remotely, with in-person meetings when she is back in town.",
  },
  {
    q: "Can we meet in person?",
    a: "When Lauren is in Amarillo, yes. The rest of the time, meetings happen by phone or video, and the project runs the same way either way.",
  },
  {
    q: "Is web design with Thrive affordable for a small business?",
    a: "Thrive works with small businesses, and website packages start at $750. You get a written proposal with the timeline and price before anything starts.",
  },
  {
    q: "What services can Amarillo businesses get?",
    a: "Web development, branding, social media management and UX design all work remotely, so they are available to Amarillo businesses. Photography sessions are in person in Dallas–Fort Worth only.",
  },
  {
    q: "How do I get started?",
    a: "Book a free intro call or send a message through the contact page. You will hear back with next steps, and a proposal follows the first conversation.",
  },
];

export default async function AmarilloPage() {
  const reel = await loadReelProjects();
  const url = absoluteUrl(PATH);
  const amarillo = { "@type": "City", name: "Amarillo", containedInPlace: { "@type": "State", name: "Texas" } };
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Web Design for Amarillo Businesses",
        serviceType: "Website design",
        description: metadata.description,
        url,
        provider: { "@id": BUSINESS_ID },
        areaServed: amarillo,
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
          { "@type": "ListItem", position: 2, name: "Amarillo Web Design", item: url },
        ],
      },
    ],
  };

  return (
    <PublicLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <div className={s.page}>
        <section className={s.hero}>
          <p className={s.eyebrow}>Amarillo, TX</p>
          <h1 className={s.h1}>Web design for Amarillo businesses</h1>
          <p className={s.lead}>
            Affordable websites, branding and social media for Amarillo small businesses — from a Dallas design
            studio with Amarillo roots.
          </p>
          <div className={s.actions}>
            <Link href="/contact" className={s.btnPrimary} style={{ background: ACCENT }}>Start your project →</Link>
            <Link href="/book" className={s.btnSecondary}>Book a free call</Link>
          </div>
        </section>

        <section className={s.story} aria-labelledby="home-heading">
          <p className={s.sectionEyebrow}>Hometown</p>
          <h2 id="home-heading" className={s.h2}>Amarillo is home</h2>
          <div className={s.storyGrid}>
            <div className={s.prose}>
              {HOMETOWN_STORY.map((text) => <p key={text.slice(0, 40)}>{text}</p>)}
              <p className={s.signoff}>— Lauren Burrell, founder of Thrive Creative Studios</p>
            </div>
            <figure className={s.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/amarillo/tascosa-graduation.jpg"
                width={768}
                height={1024}
                loading="lazy"
                alt="Lauren in her cap and gown, holding her Tascosa High School diploma, with her family on graduation day"
              />
              <figcaption>Graduation day at Tascosa High School, with my family.</figcaption>
            </figure>
          </div>
        </section>

        <section className={s.services} aria-labelledby="services-heading">
          <p className={s.sectionEyebrow}>What Thrive does</p>
          <h2 id="services-heading" className={s.h2}>For Amarillo businesses</h2>
          <div className={s.cards}>
            {SERVICES.map((svc) => (
              <Link key={svc.href} href={svc.href} className={s.card}>
                <span className={s.cardBar} style={{ background: ACCENT }} />
                <h3 className={s.cardTitle}>{svc.name}</h3>
                <p className={s.cardDesc}>{svc.desc}</p>
                <span className={s.cardMore}>More about {svc.name.toLowerCase()} →</span>
              </Link>
            ))}
          </div>
          <p className={s.priceLine}>
            <Link href="/services/digital-design#pricing">Website packages from $750 →</Link>
          </p>
        </section>

        <WorkReel projects={reel} eyebrow="The work" title="What Thrive has made" />

        <section className={s.steps} aria-labelledby="steps-heading">
          <p className={s.sectionEyebrow}>How it works</p>
          <h2 id="steps-heading" className={s.h2}>Working together from Amarillo</h2>
          <ol className={s.stepList}>
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className={s.stepNum} style={{ color: ACCENT }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepDesc}>{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.faq} aria-labelledby="faq-heading">
          <p className={s.sectionEyebrow}>Questions</p>
          <h2 id="faq-heading" className={s.h2}>Good to know</h2>
          <div className={s.faqList}>
            {FAQS.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary className={s.faqQ}>{f.q}</summary>
                <p className={s.faqA}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.cta} style={{ background: ACCENT }}>
          <h2 className={s.ctaHeading}>Ready for a website that works for your Amarillo business?</h2>
          <p className={s.ctaSub}>Tell Lauren what you&apos;re building, and you&apos;ll get a plan and a proposal that fit your timeline and budget.</p>
          <Link href="/contact" className={s.btnPrimary} style={{ background: "#fff", color: "#0a0a0a" }}>Get started →</Link>
        </section>
      </div>
    </PublicLayout>
  );
}
