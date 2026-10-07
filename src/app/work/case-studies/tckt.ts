import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/tckt";

const study: CaseStudy = {
  slug: "tckt",
  client: "TCKT",
  headline: "Movie tickets in one app, from any theater",
  lede:
    "TCKT is an app for buying movie tickets. It links your Fandango, Cinemark, AMC and Regal accounts once, then takes you from nearby theaters to showtimes, seats and checkout in a single straight path. Thrive researched, mapped, designed and prototyped it, and built the brand around it.",
  meta: [
    { label: "Brand", value: "TCKT" },
    { label: "Type", value: "iPhone app: movie ticketing" },
    { label: "Thrive's role", value: "UX research, user flows, UI design, prototype, brand" },
    { label: "Year", value: "2025" },
  ],
  heroImage: {
    src: "storage:work/tckt-cover.jpg",
    alt: "Four iPhones showing TCKT screens: the splash screen, a list of nearby Dallas theaters, showtimes and the seat map with checkout",
  },
  numbers: [
    { value: "7", label: "Steps from opening the app to a confirmed ticket" },
    { value: "4", label: "Ticketing accounts linked at sign-up" },
    { value: "8", label: "Wireframed screens" },
  ],
  about: [
    "Buying a movie ticket often means juggling apps: one theater chain's app for one cinema, a ticketing site for another, separate logins and separate loyalty points in each.",
    "TCKT puts every nearby theater in one place. Sign in once, pick a theater, a showtime and your seats, and pay on one screen — with your rewards tracked in the same app.",
  ],
  challenge: {
    intro:
      "People buy tickets under time pressure, often on a phone, sometimes in the lobby. Every extra screen or login is a chance to give up.",
    goals: [
      { title: "One app for every theater", text: "Link Fandango, Cinemark, AMC and Regal accounts once instead of switching between apps." },
      { title: "A shorter checkout", text: "Seats, price, date, ticket type and the total on one sheet, with one Purchase button." },
      { title: "Rewards you can actually see", text: "Savings and rewards trackers in settings, alongside past purchases." },
      { title: "Fast to scan", text: "Showtimes as large tap targets under each film, and a clear seat map." },
    ],
  },
  approach: {
    steps: [
      { title: "Research", text: "Thrive surveyed moviegoers about ticketing pain points, interviewed frequent Fandango and Cinemark users, and compared the major ticketing apps, including Fandango and Atom Tickets." },
      { title: "Affinity mapping", text: "Frustrations were sorted in Mural. Multiple logins, long checkouts and confusing loyalty points came out on top." },
      { title: "User flow", text: "One straight path — app load, login, theater map, films, seat selector, purchase, confirmation — with favorites and settings reachable from every step." },
      { title: "Wireframes", text: "Eight low-fidelity screens to test the flow before any color or type." },
      { title: "UI and prototype", text: "High-fidelity screens in Figma, wired into a clickable prototype in ProtoPie." },
      { title: "Testing and refinement", text: "The prototype was tested with research participants and refined from what they said, especially around loyalty tracking." },
      { title: "Brand", text: "A logo, palette, voice and guidelines, shown on merchandise and print mockups." },
    ],
  },
  showcase: [
    {
      title: "The core screens",
      text: "From the prototype: the splash screen, sign-in, a theater's showtimes by day, and the seat map with the checkout sheet pulled up.",
      layout: "grid",
      images: [
        { src: `${IMG}/phone-splash.webp`, alt: "TCKT splash screen: the white TCKT wordmark on a deep blue gradient", caption: "Splash" },
        { src: `${IMG}/phone-login.webp`, alt: "TCKT sign-in screen with username and password, a Login button and Create Account and forgot links", caption: "Sign in" },
        { src: `${IMG}/phone-showtimes.webp`, alt: "Cineapolis Luxury Cinema showtimes: a day picker across the top and three films, each with four showtime buttons", caption: "Showtimes" },
        { src: `${IMG}/phone-checkout.webp`, alt: "Checkout sheet over the seat map: film details, price, date, ticket type, three seats, subtotal, tax, service charge, total and a Purchase Ticket button", caption: "Seats and checkout" },
      ],
    },
    {
      title: "User flow",
      text: "Seven steps in a straight line. Sign-up branches off to link each ticketing account; settings holds the profile, password, past purchases, payment methods and the savings and rewards trackers.",
      layout: "wide",
      images: [
        { src: `${IMG}/user-flow.webp`, alt: "User flow diagram from App Load Screen through Login, Movie Theater Map, Movie Titles, Seat Selector and Purchase to Ticket Confirmation, with branches for account linking and settings" },
      ],
    },
    {
      title: "Wireframes",
      text: "The same flow in grayscale: splash, sign-in, theater list, films and showtimes, film details, seat map and the checkout sheet.",
      layout: "wide",
      images: [
        { src: `${IMG}/wireframes.webp`, alt: "Eight grayscale wireframes: splash, login, theater list with distances, movie list with showtimes, theater and film details, seat map, and two checkout states" },
      ],
    },
    {
      title: "Brand in use",
      text: "A popcorn bucket overflowing with tickets: every theater's tickets in one place.",
      layout: "grid",
      images: [
        { src: `${IMG}/logo.webp`, alt: "TCKT logo: a blue popcorn bucket filled with tickets, with TCKT on the front" },
        { src: `${IMG}/logo-theater.webp`, alt: "The TCKT bucket in front of a dark movie screen with red theater seats" },
        { src: "storage:projects/tckt/gallery/1.jpg", alt: "TCKT business cards: a dark card with sample contact details over red seats, and a back with the blue bucket logo" },
        { src: `${IMG}/mug.webp`, alt: "White mug with the TCKT bucket logo" },
        { src: `${IMG}/tote.webp`, alt: "White tote bag with the TCKT bucket logo" },
        { src: `${IMG}/tshirts.webp`, alt: "Black T-shirt front with a small TCKT logo and back with the bucket in front of a theater screen" },
      ],
    },
  ],
  features: [
    { title: "Every nearby theater", text: "A map and list of theaters with distances, favorites marked with a star." },
    { title: "Showtimes by day", text: "Pick a day from the strip at the top; each film shows its showtimes as buttons." },
    { title: "Clear seat map", text: "Open, reserved and selected seats in distinct tones, with the screen marked at the front." },
    { title: "One-sheet checkout", text: "Film, theater, price, date, ticket type, seats, tax, service charge and total, then one Purchase button." },
    { title: "Always one tap away", text: "Favorites and settings sit in the header of every screen; the TCKT title takes you home." },
    { title: "Rewards in one place", text: "Savings and rewards trackers and past purchases live together in settings." },
  ],
  design: {
    intro:
      "Modern and a little nostalgic: a deep theater blue for the app, red borrowed from cinema seats, and a bold all-caps wordmark that reads like a marquee.",
    colors: [
      { name: "Deep blue", hex: "#0A1F52" },
      { name: "Theater red", hex: "#9B2323" },
      { name: "Bright white", hex: "#FFFFFF" },
      { name: "Light gray", hex: "#DBD9DB" },
      { name: "Muted gray", hex: "#747572" },
    ],
    type: "Bold, all-caps headlines for the wordmark and key messages, with a clean, minimal sans-serif for film details, showtimes and prices.",
    patterns: [
      { title: "Dark screens", text: "A deep blue gradient keeps the app easy on the eyes in a dark lobby or theater." },
      { title: "Big tap targets", text: "Showtimes and seats are large, rounded buttons you can hit while walking." },
      { title: "A sheet, not a page", text: "Checkout slides up over the seat map, so you never lose sight of what you picked." },
    ],
  },
  outcome: [
    "TCKT ended as a clickable prototype covering the whole path from sign-in to a confirmed ticket, plus a full brand with guidelines.",
    "The design turns a crowded task into one straight flow, keeps the hierarchy clear on small screens, and is built for people in a hurry.",
  ],
  stack: ["Figma", "ProtoPie", "Mural"],
};

export default study;
