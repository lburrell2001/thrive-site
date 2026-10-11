import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/classic-rollers-car-club";

const study: CaseStudy = {
  slug: "classic-rollers-car-club",
  client: "Unlimited Classic Rollers Car Club",
  headline: "Website for an Amarillo Car Club and Scholarship Fund",
  lede: "Classic cars, community pride, and a site that keeps the scholarship fund front and center.",
  liveUrl: "https://classicrollersamatx.org",
  seo: {
    title: "Classic Rollers Car Club Website | Amarillo Web Development | Thrive Creative Studios",
    description:
      "How Thrive Creative Studios designed and built a website for an Amarillo car club and its scholarship fund, with online membership applications and a custom admin.",
  },
  meta: [
    { label: "Client", value: "Unlimited Classic Rollers Car Club" },
    { label: "Location", value: "Amarillo, TX" },
    { label: "Thrive's role", value: "Web development" },
    { label: "Year", value: "2026" },
  ],
  heroImage: {
    src: `${IMG}/mockup-screens.webp`,
    alt: "Classic Rollers Car Club website on a desktop monitor, with the Join the Club, Our Missions, Donate, Membership, Events and classic car insurance sections and the mobile home page floating around it",
  },
  about: [
    "Classic Rollers has been part of Amarillo since 1985. The club is a 501(c)(3), and every event it hosts raises money for the Ike Avery Scholarship Fund, which supports Amarillo-area students. We designed and built a site that tells that story and gives the club one place to send members, donors, and neighbors.",
  ],
  challenge: {
    intro:
      "News about events and fundraisers traveled by word of mouth and flyers. Someone who wanted to join, give, or come to the next pancake breakfast had no clear place to start.",
  },
  approach: {
    intro: "We built the site around the three things people come to do: join, give, and show up.",
    steps: [
      { title: "Homepage", text: "A homepage that leads with the club's mission and puts the next fundraiser at the top, with the date, location, and admission" },
      { title: "Membership", text: "A membership page with dues, meeting schedule, and an online application that goes straight to a club officer" },
      { title: "Donate", text: "A donate page with clear instructions for tax-deductible giving to the scholarship fund" },
      { title: "Events and gallery", text: "Events and gallery pages the club updates itself through a custom admin login" },
      { title: "Insurance partner", text: "A dedicated page for the club's official insurance partner" },
      { title: "The look", text: "The look takes its cue from the cars: bold, clean, and proud, with the club's motto, “All Cars Welcome,” carried throughout." },
    ],
  },
  showcase: [
    {
      layout: "wide",
      images: [
        { src: "storage:projects/classic-rollers-car-club/promo.mp4", alt: "Promo video scrolling through the Classic Rollers Car Club website" },
      ],
    },
  ],
  outcome: [
    "Classic Rollers now has a home online that matches 40 years of work in the community. Officers can post events and photos without calling a developer, and new members can apply in a couple of minutes.",
  ],
  related: {
    before: "We also work with other businesses and nonprofits in our founder's hometown. See more about ",
    label: "web development in Amarillo",
    href: "/amarillo-web-design",
    after: ".",
  },
  stack: ["Next.js", "Vercel", "Supabase", "Figma"],
};

export default study;
