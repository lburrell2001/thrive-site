import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/curl-and-co";

const study: CaseStudy = {
  slug: "curl-and-co",
  client: "Curl & Co.",
  headline: "A hair-care brand drawn from a single curl",
  lede:
    "Curl & Co. is a beauty brand concept celebrating natural hair, confidence and individuality. Thrive built its visual system: a crown drawn from one looping line, a script wordmark, a warm five-color palette, a repeat pattern and the products and signage that carry it.",
  meta: [
    { label: "Brand", value: "Curl & Co. (concept)" },
    { label: "Type", value: "Beauty and hair-care brand identity" },
    { label: "Thrive's role", value: "Brand design, visual system, mockups" },
    { label: "Year", value: "2025" },
  ],
  heroImage: {
    src: `${IMG}/brush-pattern.webp`,
    alt: "A white hairbrush wrapped in a green Curl & Co. band, lying on the brand's pattern of looping curl marks in brown, green, orange and yellow on cream",
  },
  numbers: [
    { value: "4", label: "Logo versions: main, secondary, submark and logo mark" },
    { value: "5", label: "Brand colors" },
    { value: "2", label: "Typefaces: Annabelle and Didot" },
  ],
  about: [
    "Curl & Co. is a hair-care brand built around natural curls. The identity combines softness with strength, so it feels elevated and approachable at the same time.",
    "The project focused on color theory, typography and cultural storytelling: how a brand can reflect the people it serves, and make them feel seen.",
  ],
  challenge: {
    intro:
      "The early brief, written in the margin of the first sketch page, set the direction: clean and elevated, bouncy and lightweight, inclusive and empowering, for an audience of roughly 16 to 32.",
    goals: [
      { title: "Feel like self-care with personality", text: "Polished enough for a bathroom shelf, playful enough to feel personal." },
      { title: "Build a system, not just a logo", text: "Logo versions, colors, type and a pattern that can grow into new products." },
      { title: "Readable and expressive type", text: "A script with character for headings, paired with a clean serif that stays easy to read." },
      { title: "Social-first", text: "A logo mark small and simple enough for a profile picture, stamp or icon." },
    ],
  },
  approach: {
    steps: [
      { title: "Sketching", text: "A page of pencil ideas: C letterforms, crowns, drops, leaves, flowers, a pick comb and loose curl lines. The crown and curl ideas came together into the final mark." },
      { title: "The mark", text: "A crown drawn from a single looping line, like a curl, that sits above a script “Curl & Co” wordmark." },
      { title: "Logo versions", text: "Four lockups for different spaces: the main logo, a secondary wordmark, a script C submark and the crown on its own." },
      { title: "Color, type and pattern", text: "Five colors with RGB, HEX and CMYK values, Annabelle and Didot for type, and the crown mark repeated in four of the colors on cream as a pattern." },
      { title: "Applications", text: "Shampoo and conditioner bottles, a hairbrush band, a satin hair scarf and a storefront sign, mocked up to test the system." },
    ],
  },
  showcase: [
    {
      title: "Sketches",
      text: "Where it started: dozens of quick marks around the words “Curl & Co,” with the brief written beside them.",
      layout: "grid",
      images: [
        { src: `${IMG}/sketches.webp`, alt: "Pencil sketch page titled Curl & Co with notes (clean and elevated, soft pastel colors, bouncy and lightweight, target 16–32, inclusive, empowering) and dozens of small marks: letter Cs, crowns, drops, leaves, flowers, a pick comb and curl swirls" },
      ],
    },
    {
      title: "Logo",
      text: "The main logo goes first wherever there's room: websites, footers, stationery and signage. The secondary and submark cover tighter spaces, and the logo mark handles social profile pictures, stamps and icons.",
      layout: "wide",
      images: [
        { src: `${IMG}/logos.webp`, alt: "Four Curl & Co. logo versions in dark green: the main logo with the crown above the script name, the script wordmark alone, a script C submark and the looping crown logo mark" },
      ],
    },
    {
      title: "Pattern",
      text: "The crown mark repeated in brown, green, orange and yellow on cream, for packaging, fabric and backgrounds.",
      layout: "wide",
      images: [
        { src: `${IMG}/pattern.webp`, alt: "Repeating pattern of the looping crown mark in brown, green, orange and yellow on a cream background" },
      ],
    },
    {
      title: "Applications",
      text: "Mango–Agave shampoo and Lemon–Aloe conditioner carry the logo in a dark circle. The pattern becomes a satin hair scarf, the brush gets a branded band, and the main logo hangs as a round shop sign.",
      layout: "grid",
      images: [
        { src: `${IMG}/bottles.webp`, alt: "Two cream pump bottles, Mango–Agave Shampoo and Lemon–Aloe Conditioner, each with the Curl & Co. logo in cream on a dark brown circle" },
        { src: `${IMG}/scarf.webp`, alt: "A satin hair scarf printed with the Curl & Co. curl pattern on a dark brown background" },
        { src: `${IMG}/brush.webp`, alt: "A white hairbrush with a green band carrying the Curl & Co. logo on a gold circle" },
        { src: `${IMG}/storefront-sign.webp`, alt: "Round hanging shop sign with the cream Curl & Co. logo on dark brown, mounted on a building with wrought-iron balconies" },
      ],
    },
  ],
  design: {
    intro:
      "Deep brown and forest green give the brand its strength; burnt orange, golden yellow and cream bring warmth. The script type and looping mark supply the softness.",
    colors: [
      { name: "Deep brown", hex: "#332001" },
      { name: "Forest green", hex: "#02440D" },
      { name: "Burnt orange", hex: "#BF6400" },
      { name: "Golden yellow", hex: "#EDBF00" },
      { name: "Cream", hex: "#F9F5D4" },
    ],
    type: "Headings in Annabelle, a flowing script. Body copy in Didot, with Didot small caps as the complementary style.",
    patterns: [
      { title: "One line, one curl", text: "The crown mark is drawn as a single continuous looping line, echoing a curl." },
      { title: "A crown for confidence", text: "The mark sits above the name like a crown, tying the logo to the brand's message of confidence." },
      { title: "Logo in a circle", text: "On bottles, the brush band and the sign, the logo sits in a solid circle, so it reads on any surface." },
      { title: "Pattern in every color", text: "Each repeat of the mark takes a different brand color, so the pattern shows the whole palette at once on its cream ground." },
    ],
    fullPages: [
      { src: `${IMG}/brand-guidelines.webp`, alt: "Curl & Co. brand guidelines sheet: four logo versions with usage notes, the five-color palette with RGB, HEX and CMYK values, typography, mockups and the pattern", caption: "Brand guidelines" },
    ],
  },
  outcome: [
    "Curl & Co. has a complete visual system: four logo versions with clear rules for when to use each, a five-color palette, a type pairing and a pattern, all documented in one brand guidelines sheet.",
    "The mockups show it holding together across bottles, accessories, fabric and signage, with a logo mark ready for social profiles.",
  ],
  stack: ["Illustrator", "Figma"],
};

export default study;
