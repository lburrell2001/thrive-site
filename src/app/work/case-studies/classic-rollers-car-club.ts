import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/classic-rollers-car-club";

const study: CaseStudy = {
  slug: "classic-rollers-car-club",
  client: "Unlimited Classic Rollers Car Club",
  headline: "Website for an Amarillo Car Club and Scholarship Fund",
  lede:
    "Unlimited Classic Rollers Car Club has been part of Amarillo since 1985. We designed and built its website from the ground up: online membership applications and donation forms, events that keep themselves current, and a custom admin so club officers can update the site without a developer.",
  liveUrl: "https://classicrollersamatx.org",
  seo: {
    title: "Classic Rollers Car Club Website | Amarillo Web Development | Thrive Creative Studios",
    description:
      "How Thrive Creative Studios designed and built a website for an Amarillo car club and its scholarship fund, with online membership applications and a custom admin.",
  },
  meta: [
    { label: "Client", value: "Unlimited Classic Rollers Car Club" },
    { label: "Location", value: "Amarillo, TX" },
    { label: "Thrive's role", value: "Design, development, custom admin" },
    { label: "Timeline", value: "Feb – Nov 2026" },
  ],
  heroImage: {
    src: `${IMG}/mockup-screens.webp`,
    alt: "Classic Rollers Car Club website on a desktop monitor, with the Join the Club, Our Missions, Donate, Membership, Events and classic car insurance sections and the mobile home page floating around it",
  },
  numbers: [
    { value: "1985", label: "The year the club was founded" },
    { value: "6", label: "Public pages" },
    { value: "2", label: "Online forms that land in the club's admin" },
    { value: "8", label: "Sections in the custom admin" },
    { value: "9", label: "Months from first build to latest update" },
  ],
  about: [
    "Classic Rollers has been part of Amarillo since 1985. The club is a 501(c)(3), and its fundraisers support the Ike Avery Scholarship Fund for Amarillo-area students. Its motto is “All Cars Welcome.”",
    "Members meet every second Tuesday and pay $40 a year in dues. We designed and built a site that tells the club's story and gives it one place to send members, donors and neighbors.",
  ],
  challenge: {
    intro:
      "News about events and fundraisers traveled by word of mouth and flyers. Someone who wanted to join, give or come to the next pancake breakfast had no clear place to start. The site also had to stay current after launch, run by club volunteers with no developer on call.",
    goals: [
      { title: "One place to start", text: "Join, give and show up: the three things people come to do, each one click from every page." },
      { title: "Never show a stale event", text: "The next event should lead the homepage, and past events should never linger on the calendar." },
      { title: "Let officers run it", text: "Text, events and photos should all be editable without touching code." },
      { title: "Make giving simple", text: "Clear steps for tax-deductible gifts by mail, plus a way to offer door prizes and sponsorships." },
    ],
  },
  pages: [
    {
      title: "Home",
      text: "A wide classic car photo fades to white behind the club's name, with Donate and Join buttons. When an event is coming up, a green band shows it with the date, place, admission and a live countdown. Below come the welcome, Join the Club, three photo cards for Donate, Membership and Events, and the insurance partner band.",
      desktop: { src: `${IMG}/desktop-home.webp`, alt: "Classic Rollers home page hero: “Classic Rollers Car Club” over a red classic car, with Donate and Join buttons" },
      mobile: { src: `${IMG}/mobile-home.webp`, alt: "Classic Rollers home page on a phone" },
    },
    {
      title: "About",
      text: "The club's story since 1985, who the members are, the motto “All Cars Welcome.” set large on black, and what the club does: shows and cruises, giving back and fellowship. It closes with the dues, the meeting night and buttons to join or donate.",
      desktop: { src: `${IMG}/desktop-about.webp`, alt: "About page: “Classic Rollers Since 1985” on a red band above Who We Are" },
      mobile: { src: `${IMG}/mobile-about.webp`, alt: "About page on a phone" },
    },
    {
      title: "Membership",
      text: "Dues, meeting schedule, benefits and who should join, then the application right below: name, contact details, city, vehicle and why they want to join. Each application is saved for the club's officers to follow up.",
      desktop: { src: `${IMG}/desktop-membership.webp`, alt: "Membership page: “Join Classic Rollers” with membership details and the application form" },
      mobile: { src: `${IMG}/mobile-membership.webp`, alt: "Membership page on a phone" },
    },
    {
      title: "Events",
      text: "Each upcoming event gets a card with when, where, the fee and who to call. When nothing is on the calendar, the page says the next event is on its way and shows photos from past events instead of an empty list.",
      desktop: { src: `${IMG}/desktop-events.webp`, alt: "Events page: “The next event is on its way” beside a grid of car photos" },
      mobile: { src: `${IMG}/mobile-events.webp`, alt: "Events page on a phone" },
    },
    {
      title: "Gallery",
      text: "The Classic Rollers Showcase: a packed photo grid where every seventh photo is shown large. Any photo opens full screen, and a Share Your Photos button invites members to send theirs.",
      desktop: { src: `${IMG}/desktop-gallery.webp`, alt: "Gallery page: “Classic Rollers Showcase” above a grid of classic car photos" },
      mobile: { src: `${IMG}/mobile-gallery.webp`, alt: "Gallery page on a phone" },
    },
    {
      title: "Donate",
      text: "Three numbered steps for giving to the Ike Avery Scholarship Fund by check, and a donation form so the club knows a gift is coming. No payment is taken online. The form also covers door prizes, event sponsorships and other gifts.",
      desktop: { src: `${IMG}/desktop-donate.webp`, alt: "Donate page: “Give to the Ike Avery Scholarship Fund” with How to Give steps and the donation form" },
      mobile: { src: `${IMG}/mobile-donate.webp`, alt: "Donate page on a phone" },
    },
  ],
  showcase: [
    {
      layout: "wide",
      images: [
        { src: "storage:projects/classic-rollers-car-club/promo.mp4", alt: "Promo video scrolling through the Classic Rollers Car Club website" },
      ],
    },
  ],
  features: [
    { title: "A custom admin", text: "A password-protected editor for the homepage, events, membership details and gallery. A live preview shows each change on the page, at desktop or phone size, before it's saved." },
    { title: "Photo uploads", text: "Officers drag a photo in to replace or add one, write its alt text and save. Uploads are checked for type and size." },
    { title: "Forms that reach the club", text: "Membership applications and donation forms are saved and listed in the admin with every detail, newest first." },
    { title: "Events that keep themselves current", text: "The next event leads the homepage with a live countdown. Each event drops off the site after its day ends, so the calendar never shows something that has already happened." },
    { title: "A gallery built for phones", text: "A full-screen photo viewer with arrow keys on a desktop and swiping on a phone." },
    { title: "Insurance partner", text: "The club's classic car insurance partner, Texas Home & Highway Insurance Services, has a band on the homepage and links in the header and footer, all pointing to its classic car quote page." },
    { title: "Features that switch on and off", text: "The scholarship page and its online application can be turned back on with a single setting. While it's off, the page, its menu link and its sitemap entry all stay hidden." },
  ],
  design: {
    intro:
      "The look takes its cue from the cars and the club's logo: bold, clean and proud. Every page opens on a solid band of red, green or black, and the motto “All Cars Welcome.” is carried throughout.",
    colors: [
      { name: "Classic red", hex: "#e31b23" },
      { name: "Club green", hex: "#00853f" },
      { name: "Black", hex: "#000000" },
      { name: "Soft black", hex: "#1a1a1a" },
      { name: "Light gray", hex: "#f5f5f5" },
      { name: "White", hex: "#ffffff" },
    ],
    type: "Bebas Neue, a tall, condensed all-caps face, for headlines, with Inter for everything else, from body text to form labels.",
    patterns: [
      { title: "Color-blocked headers", text: "Each page opens on its own solid color: red for About, green for Membership, Gallery and Donate, black for Events." },
      { title: "The motto, big", text: "“All Cars Welcome.” fills the About page in huge type, with “Welcome.” in red." },
      { title: "Photo cards with a color bar", text: "The homepage cards for Donate, Membership and Events each carry a short red, green or white bar above the title." },
      { title: "A header that steps aside", text: "The header sits clear over each page's hero and turns solid white once you scroll." },
    ],
    fullPages: [
      { src: `${IMG}/full-home.webp`, alt: "Full-length screenshot of the Classic Rollers home page", caption: "Home" },
      { src: `${IMG}/full-about.webp`, alt: "Full-length screenshot of the About page", caption: "About" },
      { src: `${IMG}/full-gallery.webp`, alt: "Full-length screenshot of the Gallery page", caption: "Gallery" },
      { src: `${IMG}/full-donate.webp`, alt: "Full-length screenshot of the Donate page", caption: "Donate" },
    ],
  },
  timeline: [
    { when: "Feb 2026", title: "First build", text: "Home, About, Events, Membership, Scholarship, Gallery and Donate pages, with downloadable application forms." },
    { when: "Mar 2026", title: "The club can run it", text: "The custom admin with live preview and photo uploads, online membership and scholarship applications, the club's logo and a Donate pop-up." },
    { when: "Sep 2026", title: "Insurance partner", text: "Texas Home & Highway Insurance Services is featured as the club's classic car insurance partner, and search engines are pointed at the club's own domain, classicrollersamatx.org." },
    { when: "Oct 2026", title: "A fresh look", text: "A refreshed design and a new About page. Past events now hide on their own, donations get their own form, the gallery works better on phones and the scholarship page is switched off." },
    { when: "Nov 2026", title: "Ongoing care", text: "An Insurance link joins the main menu." },
  ],
  mobile: {
    intro: "Members and neighbors look up events, dues and how to give on the go. Every page and form works as well on a phone as on a desktop, with Contact and Donate buttons right in the menu.",
    shots: [
      { src: `${IMG}/mobile-home.webp`, alt: "Home page on a phone" },
      { src: `${IMG}/mobile-about.webp`, alt: "About page on a phone" },
      { src: `${IMG}/mobile-membership.webp`, alt: "Membership page on a phone" },
      { src: `${IMG}/mobile-gallery.webp`, alt: "Gallery page on a phone" },
      { src: `${IMG}/mobile-donate.webp`, alt: "Donate page on a phone" },
    ],
  },
  outcome: [
    "Classic Rollers now has a home online that matches four decades in the community. New members can apply in a couple of minutes, and donors know exactly how to give to the Ike Avery Scholarship Fund.",
    "Officers update events, photos and page text themselves and see each change before it goes live. Applications and donation forms wait for them in one place, and the homepage always shows the next event, never the last one.",
  ],
  related: {
    before: "We also work with other businesses and nonprofits in our founder's hometown. See more about ",
    label: "web development in Amarillo",
    href: "/amarillo-web-design",
    after: ".",
  },
  stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase", "Vercel", "Figma"],
};

export default study;
