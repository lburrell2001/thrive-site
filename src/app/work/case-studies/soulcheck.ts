import type { CaseStudy } from "../caseStudies";

// Short on purpose: the project record had no write-up, so this covers only what the
// delivered screens, brand mockups and Thrive's own SoulCheck spotlight posts show.

const IMG = "/case-studies/soulcheck";

const study: CaseStudy = {
  slug: "soulcheck",
  client: "SoulCheck",
  headline: "A calm place to check in with yourself",
  lede:
    "SoulCheck is a mobile app for daily emotional check-ins and journaling. Thrive designed the brand and the app's screens, from the first log-in to the monthly mood calendar.",
  meta: [
    { label: "Brand", value: "SoulCheck" },
    { label: "Type", value: "Wellness app" },
    { label: "Thrive's role", value: "Branding & UX design" },
    { label: "Year", value: "2025" },
  ],
  heroImage: {
    src: "storage:projects/soulcheck/cover.jpg",
    alt: "A phone on a round wooden board showing the SoulCheck home screen: a 22-day check-in streak, today's affirmation, a weekly mood chart and recent entries",
  },
  about: [
    "SoulCheck is built around emotional check-ins and reflection. You say how you feel each day, write about it if you want to, and over time see your own patterns.",
    "Because the subject is mental health, the design had to feel safe and unhurried: clear, calm screens that never make checking in feel like a chore.",
  ],
  challenge: {
    intro:
      "Thrive's brief for the project fit in three words: thoughtful, layered, real. The brand needed a quiet confidence, and the app needed to make a daily habit feel easy.",
  },
  showcase: [
    {
      title: "The app",
      text: "The home screen opens with “Time for a SoulCheck,” your check-in streak and the day's affirmation, then a weekly mood chart and your recent entries.",
      layout: "grid",
      images: [
        { src: `${IMG}/spotlight.webp`, alt: "Thrive client spotlight graphic, “Branding & UX Design,” with the SoulCheck wordmark above the home screen and the journal screen on two phones" },
        { src: `${IMG}/screens.webp`, alt: "“SoulCheck x Thrive” graphic with three phones: the journal with a Guided/Free switch, the June and May mood calendars, and the delete-account screen with a Face ID prompt" },
        { src: "/services/social/web/thrive-story-01.jpg", alt: "A hand holding a phone with the SoulCheck home screen on a green background" },
      ],
    },
    {
      title: "The full flow",
      text: "Every screen was laid out end to end: password and username recovery, the mood check-in in each of its states, guided and free journaling, the entry log with filters, the calendar and settings.",
      layout: "grid",
      images: [
        { src: `${IMG}/screen-flow.webp`, alt: "The SoulCheck screens laid out on a dark canvas under the label “UX that makes sense”: forgot username and password, mood check-ins, journal, log, filter, calendar and settings" },
      ],
    },
    {
      title: "The brand",
      text: "The mark is a seated, meditating figure drawn in one line, with legs that form an infinity loop. It pairs with a flowing script wordmark.",
      layout: "grid",
      images: [
        { src: "storage:projects/soulcheck/gallery/1.jpg", alt: "Dark green mug with a sage handle, printed with the SoulCheck meditating-figure mark and script wordmark, against a brick wall" },
        { src: "storage:projects/soulcheck/gallery/2.jpg", alt: "The SoulCheck meditating-figure mark debossed in dark green on textured white paper, lit by window shadows" },
      ],
    },
  ],
  features: [
    { title: "Daily mood check-in", text: "“How are you feeling today?” Pick one of five faces, from sad to happy, and add a note." },
    { title: "Streak and affirmation", text: "The home screen counts your check-in streak and shows an affirmation for the day." },
    { title: "Weekly mood chart", text: "A line chart of the week's moods, Sunday through Saturday." },
    { title: "Guided or free journaling", text: "A switch moves between writing freely and answering a prompt such as “If my emotions could speak, they would say…”" },
    { title: "Entries and filters", text: "Recent entries are listed by date with their mood, and can be filtered by month, day, year or mood." },
    { title: "Mood calendar", text: "Each month is a calendar with the day's mood face in every square." },
    { title: "Settings and account", text: "A profile, app preferences, a daily reminder, log off, and an account deletion step that asks for your password first." },
  ],
  design: {
    intro:
      "Earthy and grounded: deep forest green, sand and sage, with a warm brown for highlights. Its mood board drew on green landscapes, stacked stones and matcha.",
    colors: [
      { name: "Forest", hex: "#2f3a2e" },
      { name: "Sand", hex: "#d1c1a7" },
      { name: "Earth", hex: "#8d7353" },
      { name: "Moss", hex: "#6c7b5a" },
      { name: "Sage", hex: "#aab68a" },
    ],
    type: "A flowing script for the wordmark and journal prompts, with a clean sans-serif for headings and body text.",
    patterns: [
      { title: "Sand backgrounds", text: "Screens sit on sand rather than white, which keeps them soft on the eyes." },
      { title: "Faces, not numbers", text: "Mood is recorded and shown as simple faces, from the check-in to the calendar." },
      { title: "The mark at the top", text: "The meditating figure heads every screen in place of a title bar." },
    ],
    fullPages: [
      { src: `${IMG}/palette.webp`, alt: "“The visual language” graphic: five vertical bands of forest green, sand, brown, moss and sage with sample heading and body type", caption: "The visual language" },
    ],
  },
  outcome: [
    "SoulCheck has a brand and a complete set of app screens to build from: a recognizable mark, a calm palette, and every step of the check-in, journal and account flows designed.",
  ],
};

export default study;
