import type { CaseStudy } from "../caseStudies";

const G = "storage:projects/2026-graduation-pictures/gallery";

const study: CaseStudy = {
  slug: "2026-graduation-pictures",
  client: "Class of 2026 graduate",
  headline: "Senior portraits with more than one mood",
  lede:
    "A senior portrait session for a Class of 2026 graduate. Thrive planned the creative direction and shot it: three studio setups, formal and personal wardrobe, and a set of portraits that show both the milestone and the person behind it.",
  meta: [
    { label: "Client", value: "Class of 2026 graduate" },
    { label: "Type", value: "Senior portrait photography" },
    { label: "Thrive's role", value: "Creative direction & photography" },
    { label: "Year", value: "2026" },
  ],
  heroImage: {
    src: "storage:work/2026-graduation-pictures-cover.jpg",
    alt: "Profile portrait of a smiling graduate in a cap with a red 2026 tassel against a saturated red backdrop",
  },
  numbers: [
    { value: "3", label: "Studio setups" },
    { value: "4", label: "Portraits in the gallery" },
  ],
  about: [
    "Graduation photos are a keepsake, but they are often the same picture every year: a plain backdrop, a diploma and a stiff smile.",
    "This session was planned to tell a fuller story of the graduate at this moment, formal enough to honor the occasion and personal enough to feel like the graduate.",
  ],
  challenge: {
    intro:
      "The portraits had to feel personal and editorial while still marking the occasion, and work across several moods without looking like separate shoots.",
    goals: [
      { title: "Go past the yearbook photo", text: "Images with personality, not a stiff pose in front of a plain backdrop." },
      { title: "Honor the milestone", text: "The cap and the 2026 tassel stay in the story." },
      { title: "Range without losing cohesion", text: "Several moods and settings that still read as one set." },
    ],
  },
  approach: {
    steps: [
      { title: "Three setups", text: "A bold red backdrop for high-contrast drama, a warm neutral setup for something closer and more relaxed, and a dark, low-key setup for editorial depth." },
      { title: "Layered wardrobe", text: "Formal graduation attire with the cap and tassel, mixed with the graduate's own street style: an olive corduroy shirt, a dark jacket over a red tie, jeans and loafers." },
      { title: "Room to be themselves", text: "Profiles, a close-up and a seated full-length pose, with space for the graduate's own energy and smile rather than one formal pose." },
    ],
  },
  showcase: [
    {
      title: "The gallery",
      text: "Three setups, one graduate. Each one has its own mood; the graduate's smile and the red tassel tie them together.",
      layout: "grid",
      images: [
        { src: "storage:work/2026-graduation-pictures-cover.jpg", alt: "Profile portrait in cap and red 2026 tassel against a bright red backdrop", caption: "Red backdrop" },
        { src: `${G}/1775064259694-Untitled-3.png`, alt: "Close-up of the graduate laughing in an olive corduroy shirt, holding a cap with its red 2026 tassel beside their face, on a warm neutral backdrop", caption: "Warm neutral" },
        { src: `${G}/1775064580831-IMG_1252.jpg`, alt: "Side profile in cap, white collar and red tie against a dark brown backdrop, lit warmly from the front", caption: "Low-key profile" },
        { src: `${G}/1775064582554-IMG_1239.jpg`, alt: "Full-length portrait of the graduate seated on a vintage suitcase in a dark jacket, red tie, jeans and loafers, smiling under a soft spotlight", caption: "Low-key full length" },
      ],
    },
  ],
  design: {
    intro: "Lighting and color did the work: each backdrop sets a mood, and the red tassel repeats through every frame.",
    patterns: [
      { title: "High contrast in red", text: "Hard light on a saturated red wall for the boldest, most graphic portrait." },
      { title: "Warm and close", text: "A soft neutral backdrop and a tight crop for the most personal frame." },
      { title: "Light from the dark", text: "A dark backdrop with a pool of warm light, chiaroscuro style, for the editorial portraits." },
    ],
  },
  outcome: [
    "The graduate has a set of portraits that feel both celebratory and cinematic. Each setup has its own mood, and the graduate's energy ties them together.",
    "The images work as standalone portraits, as social media posts and as keepsake prints: a complete record of the Class of 2026 milestone.",
  ],
  stack: ["Canon EOS Rebel T7"],
};

export default study;
