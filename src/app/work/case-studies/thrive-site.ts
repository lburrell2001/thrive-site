import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/thrive-site";

const study: CaseStudy = {
  slug: "thrive-site",
  client: "Thrive Creative Studios",
  headline: "A studio website that also runs the studio",
  lede:
    "This is Thrive's own website, designed and built by Lauren Burrell. It started in December 2025 as a portfolio. Since then it has been through a full rebrand, and it now includes a client portal and a private workspace where the studio handles leads, proposals, invoices and email.",
  liveUrl: "https://thrivecreativestudios.org",
  meta: [
    { label: "Client", value: "Thrive Creative Studios (in-house)" },
    { label: "Type", value: "Studio website, client portal and business tools" },
    { label: "Thrive's role", value: "Brand, design and development" },
    { label: "Timeline", value: "Dec 2025 – ongoing" },
  ],
  heroImage: {
    src: "storage:projects/thrive-site/cover.jpg",
    alt: "A laptop on a metal grate showing an earlier Thrive homepage: “Branding & web design that actually feels like you.” with green, blue and pink service pills",
    caption: "The homepage before the spring 2026 rebrand.",
  },
  numbers: [
    { value: "5", label: "Service pages, one per service" },
    { value: "5", label: "Brand colors" },
    { value: "10", label: "Months of design and development so far" },
  ],
  about: [
    "Thrive Creative Studios is Lauren Burrell's design studio in Dallas, Texas. It does branding, web design, UX design, social media and photography.",
    "The studio exists for Black creatives, and Black women in particular, who have shaped the creative world without being given the seat, the stage or the spotlight. The website is the first place most clients meet it, so it has to show the work and the attitude together.",
  ],
  challenge: {
    intro:
      "A studio site has two jobs. It has to sell the work to small businesses, churches and creatives, and it has to look like the studio that made it. As Thrive grew, a third job showed up: the business behind the site needed one home for clients, proposals, invoices and follow-ups.",
    goals: [
      { title: "Show the range", text: "Branding, web, UX, social and photography each get a clear page and real projects to back them up." },
      { title: "Look like Thrive", text: "Bold color, heavy type and a personality you can feel before you read a word." },
      { title: "Be found", text: "Service pages that answer what people search for, in Dallas and in Amarillo." },
      { title: "Run the business in one place", text: "Leads, proposals, invoices, client files and email live next to the website instead of in scattered apps." },
    ],
  },
  approach: {
    steps: [
      { title: "Launch the portfolio", text: "Project pages are read from a database, so a new project goes live without a code change. A contact form saves every inquiry and emails it to the studio." },
      { title: "Rebrand the whole site", text: "In spring 2026 the homepage and then every page moved to the new Thrive identity: the multicolor logomark, the five-color palette and Bungee headlines." },
      { title: "Add a client portal", text: "Clients sign in to see their project's progress, share files, pay invoices and sign proposals." },
      { title: "Build the studio's tools", text: "A private admin area grew into a CRM, analytics, a proposal builder, an email designer and booking, built feature by feature as the studio needed them." },
      { title: "Grow search traffic", text: "A journal, fuller service pages with FAQs, structured data and a page for Amarillo businesses." },
    ],
  },
  pages: [
    {
      title: "Home",
      text: "“A full service creative agency” in oversized type around the Thrive wordmark. Below it come a marquee of services, a tabbed look at each service, the process and a reel of recent work.",
      desktop: { src: `${IMG}/desktop-home.webp`, alt: "Thrive homepage: the THRIVE wordmark over the words “A full service creative agency” in large grey type" },
      mobile: { src: `${IMG}/mobile-home.webp`, alt: "Thrive homepage on a phone" },
    },
    {
      title: "Service pages",
      text: "Each service has its own page: what it is, what you get, the four steps from brief to handoff, related projects and answers to common questions. This is the Web Design page.",
      desktop: { src: `${IMG}/desktop-web-design.webp`, alt: "Web Design service page with a hero photo of Squeeze Shop lemonade cans and a “Start your project” button" },
      mobile: { src: `${IMG}/mobile-web-design.webp`, alt: "Web Design service page on a phone" },
    },
    {
      title: "Portfolio",
      text: "“Creativity without limits.” Every project as a card, with filters for brand design, digital design, UX design, social media and photography.",
      desktop: { src: `${IMG}/desktop-portfolio.webp`, alt: "Portfolio page: “Creativity without limits.” above category filters and project cards" },
      mobile: { src: `${IMG}/mobile-portfolio.webp`, alt: "Portfolio page on a phone" },
    },
    {
      title: "About",
      text: "“Built for the ones who were missing from the room.” The mission, the founder and the studio's values: representation, boldness, excellence and community.",
      desktop: { src: `${IMG}/desktop-about.webp`, alt: "About page: “Built for the ones who were missing from the room.” beside the mission statement" },
      mobile: { src: `${IMG}/mobile-about.webp`, alt: "About page on a phone" },
    },
    {
      title: "Contact",
      text: "“Ready to Thrive?” A short project form, the studio's contact details and a link to book a free intro call.",
      desktop: { src: `${IMG}/desktop-contact.webp`, alt: "Contact page: “Ready to Thrive?” with the Start a Project form and contact details" },
      mobile: { src: `${IMG}/mobile-contact.webp`, alt: "Contact page on a phone" },
    },
    {
      title: "Journal",
      text: "“Notes from the studio.” Straight answers to the questions clients ask most, written and published from the studio's own editor.",
      desktop: { src: `${IMG}/desktop-journal.webp`, alt: "Journal page: “Notes from the studio” with an article card" },
      mobile: { src: `${IMG}/mobile-journal.webp`, alt: "Journal page on a phone" },
    },
    {
      title: "Web design for Amarillo",
      text: "A page for businesses in Lauren's hometown, with her own story of growing up in Amarillo.",
      desktop: { src: `${IMG}/desktop-amarillo.webp`, alt: "Amarillo page: “Web design for Amarillo businesses” on a black hero" },
      mobile: { src: `${IMG}/mobile-amarillo.webp`, alt: "Amarillo page on a phone" },
    },
  ],
  features: [
    { title: "Projects from a database", text: "Every portfolio page is built from the project's record and its photos in storage, so adding work takes minutes." },
    { title: "Client portal", text: "Clients sign in with an emailed code to follow progress, upload files, pay invoices by card and sign proposals online. Logins they share are stored encrypted." },
    { title: "Proposals and reminders", text: "Proposals are built from templates, signed in the browser and saved as PDFs. Unpaid invoices and unsigned proposals get reminders by email, and by text when the client has opted in." },
    { title: "A CRM built for one studio", text: "One record per person, a pipeline of deals, follow-up tasks and a timeline of every email, proposal and invoice. Replies to the studio's emails are caught and logged automatically." },
    { title: "Email designer", text: "Newsletters and one-to-one emails are designed from sections or imported from Canva, sent in the Thrive style, and can be scheduled. Sign-ups are double opt-in." },
    { title: "First-party analytics", text: "Page views are counted without cookies, bots are dropped, and each inquiry is linked back to how the visitor found the site. Search Console data can sit alongside it." },
    { title: "Search groundwork", text: "Service pages lead with the service and the place, carry FAQs and structured data, and the journal adds new pages to the sitemap when it publishes." },
    { title: "Booking and reviews", text: "Visitors can book an intro call in open hours, and clients can leave a review that shows on the service pages once approved." },
  ],
  design: {
    intro:
      "Loud on purpose. The site uses the colors of the Thrive logomark at full strength, heavy display type and rounded, sticker-like buttons, set against plenty of white.",
    colors: [
      { name: "Magenta", hex: "#d12e83" },
      { name: "Orange", hex: "#ea6b2c" },
      { name: "Blue", hex: "#3b43af" },
      { name: "Mint", hex: "#71f082" },
      { name: "Purple", hex: "#861dc5" },
      { name: "Black", hex: "#000000" },
      { name: "Cream", hex: "#fff7fb" },
    ],
    type: "Bungee for headlines, buttons and labels; Bai Jamjuree for body text.",
    patterns: [
      { title: "Color-coded navigation", text: "About, Services, Portfolio and Contact each have their own brand color in the header." },
      { title: "Ghost words", text: "A huge pale word like “Work” or “Services” sits behind each page title." },
      { title: "Colored top borders", text: "Cards and stat boxes carry a strip of magenta, orange, mint or blue." },
      { title: "One look everywhere", text: "Site emails share the same black header, logo, Bungee buttons and fonts as the website." },
    ],
    fullPages: [
      { src: `${IMG}/full-web-design.webp`, alt: "Full-length screenshot of the Web Design service page", caption: "Web Design" },
      { src: `${IMG}/full-portfolio.webp`, alt: "Full-length screenshot of the Portfolio page", caption: "Portfolio" },
      { src: `${IMG}/full-about.webp`, alt: "Full-length screenshot of the About page", caption: "About" },
    ],
  },
  timeline: [
    { when: "Dec 2025", title: "Launch", text: "The portfolio goes live with project pages read from the database, then a contact form that saves and emails every inquiry." },
    { when: "Jan – Feb 2026", title: "Polish", text: "Vercel Analytics, a footer on every page, a call-to-action banner, a reworked social media page and a new tagline." },
    { when: "Mar – Apr 2026", title: "Rebrand", text: "A new homepage in the new Thrive identity, then the full site." },
    { when: "Apr – May 2026", title: "Client portal and admin", text: "File uploads, project progress, invoices and archived projects, plus Google Tag Manager." },
    { when: "Sep 2026", title: "Proposals, CRM and analytics", text: "An encrypted credentials vault, the proposal builder with online signing, reminders by email and text, the CRM, site analytics, the journal, reviews and call booking." },
    { when: "Sep – Oct 2026", title: "Email and search", text: "Newsletters, the email designer, branded emails, scheduled sends, print campaigns with QR codes, fuller service pages and the Amarillo page." },
  ],
  mobile: {
    intro: "Every page works on a phone as well as on a desktop, with a compact menu in place of the color buttons.",
    shots: [
      { src: `${IMG}/mobile-home.webp`, alt: "Homepage on a phone" },
      { src: `${IMG}/mobile-web-design.webp`, alt: "Web Design page on a phone" },
      { src: `${IMG}/mobile-portfolio.webp`, alt: "Portfolio page on a phone" },
      { src: `${IMG}/mobile-about.webp`, alt: "About page on a phone" },
      { src: `${IMG}/mobile-amarillo.webp`, alt: "Amarillo page on a phone" },
    ],
  },
  outcome: [
    "Thrive's website now shows the studio's work and personality, and it is also where the studio does its business.",
    "An inquiry becomes a contact and a deal on its own. Proposals are signed and invoices paid in the client portal, and the studio can see which pages and sources bring in work. The site keeps growing with the studio.",
  ],
  stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase", "Vercel", "Resend", "Stripe"],
};

export default study;
