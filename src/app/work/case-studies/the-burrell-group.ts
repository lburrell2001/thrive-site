import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/the-burrell-group";

const study: CaseStudy = {
    slug: "the-burrell-group",
    client: "The Burrell Group",
    headline: "A website as credible as the programs it supports",
    lede:
      "The Burrell Group helps public agencies and prime contractors deliver transit, airport and civic programs across Texas. Thrive designed and built their new website from the ground up, then kept going: a click-to-edit content system, vendor registration with email routing, first-party analytics and full search-engine groundwork.",
    liveUrl: "https://www.theburrellgroup.net",
    meta: [
      { label: "Client", value: "The Burrell Group, Inc." },
      { label: "Industry", value: "Public program & engagement consulting" },
      { label: "Thrive's role", value: "Design, development, content system" },
      { label: "Timeline", value: "Dec 2025 – Oct 2026" },
    ],
    heroImage: {
      src: `${IMG}/mockup-screens.webp`,
      alt: "Five pages of The Burrell Group website floating above a laptop",
    },
    numbers: [
      { value: "12", label: "Public pages" },
      { value: "3", label: "Service lines, each with its own page" },
      { value: "4", label: "Staff tools: editor, forms, analytics, news" },
      { value: "10", label: "Months of design and development" },
    ],
    about: [
      "The Burrell Group, Inc. (TBG) is a Dallas consulting firm established in 1999. Its teams support public programs from planning through closeout: program and project support, environmental services, and communications and public engagement.",
      "Its clients include DART, DFW Airport, Trinity Metro, the City of Fort Worth, Houston METRO and NCTCOG, and it works alongside prime contractors such as HDR, HNTB, Jacobs and Archer Western.",
    ],
    challenge: {
      intro:
        "TBG's work is technical, regulated and hard to summarize. The site had to explain it clearly to agencies, contractors and job seekers, and look as credible as the programs the firm supports. The site also had to keep working after launch, run by a busy staff with no developer on call.",
      goals: [
        { title: "Make dense work easy to scan", text: "Three service lines with about a dozen sub-services, written for procurement teams who skim." },
        { title: "Earn trust at first glance", text: "Show real field photos, real clients and real projects, not stock imagery and vague claims." },
        { title: "Let staff run it", text: "Headlines, photos, bullet lists, projects and news should all be editable without touching code." },
        { title: "Turn visits into relationships", text: "Vendor registrations and inquiries should reach the right people, and staff should see who is visiting." },
      ],
    },
    pages: [
      {
        title: "Home",
        text: "A full-width video hero with a diagonal green panel leads with what TBG does and who it works with. Below it come the three ways TBG helps, its capabilities, service cards, a “Trusted by” logo wall and featured projects.",
        desktop: { src: `${IMG}/desktop-home.webp`, alt: "The Burrell Group home page hero: “Project support delivered with results that create lasting partnerships.”" },
        mobile: { src: `${IMG}/mobile-home.webp`, alt: "The Burrell Group home page on a phone" },
      },
      {
        title: "Who We Are",
        text: "The firm's story since 1999, its values (Excellence, Client Satisfaction, Community, Legacy), the leadership team and a map to the Dallas office. An “On this page” menu jumps between sections.",
        desktop: { src: `${IMG}/desktop-who-we-are.webp`, alt: "Who We Are page with a photo hero and the values section" },
        mobile: { src: `${IMG}/mobile-who-we-are.webp`, alt: "Who We Are page on a phone" },
      },
      {
        title: "What We Do",
        text: "Every service line on one page, opened by a grid of TBG's own field photos. Each card leads to a detailed service page.",
        desktop: { src: `${IMG}/desktop-services.webp`, alt: "What We Do page: “We build with structure and for lasting impact.” with service cards" },
        mobile: { src: `${IMG}/mobile-services.webp`, alt: "What We Do page on a phone" },
      },
      {
        title: "Service pages",
        text: "One template for every service: what it is, what's included and how to get in touch. A section bar highlights where you are as you scroll.",
        desktop: { src: `${IMG}/desktop-service-program-support.webp`, alt: "Program & Project Support Services page with the section bar and a field photo" },
        mobile: { src: `${IMG}/mobile-service-program-support.webp`, alt: "A service page on a phone" },
      },
      {
        title: "Who We Serve",
        text: "Agencies, contractors and partner organizations, grouped the way procurement teams think about them. Client logos reveal each organization's name on hover.",
        desktop: { src: `${IMG}/desktop-who-we-serve.webp`, alt: "Who We Serve page with the Dallas skyline and a grid of client logos" },
        mobile: { src: `${IMG}/mobile-who-we-serve.webp`, alt: "Who We Serve page on a phone" },
      },
      {
        title: "Our Work",
        text: "A mosaic of eight programs, from TEXRAIL and the Silver Line to the DFW Terminal Renewal program. Staff can pick each tile's hover color from the admin.",
        desktop: { src: `${IMG}/desktop-projects.webp`, alt: "Our Work page: “Public initiatives, delivered.” above a photo mosaic" },
        mobile: { src: `${IMG}/mobile-projects.webp`, alt: "Our Work page on a phone" },
      },
      {
        title: "Join Our Vendor Network",
        text: "A vendor registration form for firms that want to partner on upcoming procurements: company, services, business structure and revenue band. Each submission is saved and emailed to the right team.",
        desktop: { src: `${IMG}/desktop-contact.webp`, alt: "Vendor network registration form with contact details" },
        mobile: { src: `${IMG}/mobile-contact.webp`, alt: "Vendor registration page on a phone" },
      },
      {
        title: "Work With Us",
        text: "A careers page showing how to apply, the roles TBG often needs and what it's like to work there. One button sends a résumé.",
        desktop: { src: `${IMG}/desktop-join-our-team.webp`, alt: "Work With Us page: “We build teams with intention and work that carries weight.”" },
        mobile: { src: `${IMG}/mobile-join-our-team.webp`, alt: "Work With Us page on a phone" },
      },
    ],
    features: [
      { title: "Click-to-edit content", text: "Staff turn on edit mode and change any headline, paragraph, bullet list or photo right on the page. Gold accent words are kept when a headline is reworded." },
      { title: "Forms that reach the right people", text: "Vendor registrations and service inquiries are saved and emailed instantly. Each form has its own recipient list that staff manage themselves." },
      { title: "Built-in analytics", text: "A private dashboard covers visitors, top pages, traffic sources, cities and devices. It also shows each visitor's path through the site and which organizations' networks they came from. Bots and staff are filtered out." },
      { title: "Search and AI groundwork", text: "Structured data for the firm, its services and its articles, plus canonical URLs, a sitemap, share images and an llms.txt file. Search engines and AI assistants can describe TBG accurately." },
      { title: "Security", text: "A PIN-protected staff area with signed sessions and rate limiting, plus strict browser security headers." },
      { title: "Polish that shows", text: "A looping hero video with smooth crossfades, a full-screen photo viewer with swipe support, scroll-in animations that respect reduced-motion settings, and tap-to-call contact links." },
    ],
    design: {
      intro:
        "An industrial, architectural look for a firm that works on rail lines and runways: square corners everywhere, structural greens and a gold drawn from TBG's logo.",
      colors: [
        { name: "Gold", hex: "#8d7e22" },
        { name: "Light gold", hex: "#d4c481" },
        { name: "Bronze", hex: "#9f996a" },
        { name: "Architectural green", hex: "#3f5d4a" },
        { name: "Parchment", hex: "#e5dfc0" },
        { name: "Ivory", hex: "#fdfdfa" },
        { name: "Steel", hex: "#101820" },
      ],
      type: "A clean system font stack in heavy, tightly spaced headings. There are no fonts to download, and it reads well on any device.",
      patterns: [
        { title: "Gold accent words", text: "One phrase in each headline is set in gold to carry the message: “accountability and results,” “partnerships that last.”" },
        { title: "Diagonal green panels", text: "Hero text sits on an angled green overlay that echoes structural steel without hiding the photography." },
        { title: "Real field photography", text: "Inspections, night pours and community events from TBG's own teams appear in every hero." },
        { title: "No rounded corners", text: "Square buttons, cards and frames give the whole site an engineered, precise feel." },
      ],
      fullPages: [
        { src: `${IMG}/full-home.webp`, alt: "Full-length screenshot of The Burrell Group home page", caption: "Home" },
        { src: `${IMG}/full-who-we-are.webp`, alt: "Full-length screenshot of the Who We Are page", caption: "Who We Are" },
        { src: `${IMG}/full-service-program-support.webp`, alt: "Full-length screenshot of a service page", caption: "Service page" },
        { src: `${IMG}/full-projects.webp`, alt: "Full-length screenshot of the Our Work page", caption: "Our Work" },
      ],
    },
    timeline: [
      { when: "Dec 2025", title: "Launch", text: "The new site goes live with every core page, news and the service pages." },
      { when: "Jan – Feb 2026", title: "Homepage and mobile refinements", text: "A new white header, a stronger homepage and a reworked mobile menu." },
      { when: "Jun 2026", title: "Staff can edit everything", text: "The admin area and click-to-edit content system arrive, along with the project showcase." },
      { when: "Jul 2026", title: "Forms and contact", text: "Instant email alerts for every form, tap-to-call links and a refined services lineup." },
      { when: "Sep 2026", title: "Analytics, search and security", text: "First-party analytics, structured data and sitemaps, the photo viewer, staff sign-in and security headers." },
      { when: "Sep – Oct 2026", title: "Ongoing care", text: "Per-form recipients, a report of which organizations visit, and continued updates." },
    ],
    mobile: {
      intro: "Agency staff, contractors and job seekers check the site from wherever they are. Every page works as well on a phone as it does on a desktop.",
      shots: [
        { src: `${IMG}/mobile-home.webp`, alt: "Home page on a phone" },
        { src: `${IMG}/mobile-service-engagement.webp`, alt: "Communications & Public Engagement page on a phone" },
        { src: `${IMG}/mobile-who-we-are.webp`, alt: "Who We Are page on a phone" },
        { src: `${IMG}/mobile-projects.webp`, alt: "Our Work page on a phone" },
        { src: `${IMG}/mobile-contact.webp`, alt: "Vendor registration page on a phone" },
      ],
    },
    outcome: [
      "TBG now has a site that matches the scale of the programs it supports and that its own staff can keep current.",
      "Headlines, photos, team members, projects and news change in minutes from the page itself. Registrations and inquiries reach the right inbox the moment they're sent. And the analytics dashboard shows who is looking: which pages, from where, and from which organizations.",
    ],
    stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase", "Vercel", "Resend"],
  };

export default study;
