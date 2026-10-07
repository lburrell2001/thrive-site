import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/squeeze-shop";

const study: CaseStudy = {
  slug: "squeeze-shop",
  client: "The Squeeze Shop",
  headline: "A retro lemonade brand with a mascot doing the talking",
  lede:
    "The Squeeze Shop is a lemonade brand built around one character: a grinning cup with a lemon in hand. Thrive designed the mascot, the logo, a five-color palette, a lemon pattern and the packaging, from cups to a Strawberry & Peach Lemonade can.",
  meta: [
    { label: "Brand", value: "The Squeeze Shop" },
    { label: "Type", value: "Lemonade brand" },
    { label: "Thrive's role", value: "Brand identity, mascot, packaging" },
    { label: "Timeline", value: "Apr – May 2025" },
  ],
  heroImage: {
    src: "storage:projects/squeeze-shop/cover.jpg",
    alt: "Subway billboard of The Squeeze Shop: the blue cup mascot giving a thumbs-up beside the logo on a pink lemon pattern, with a man walking past",
  },
  numbers: [
    { value: "5", label: "Brand colors" },
    { value: "2", label: "Typefaces" },
    { value: "4", label: "Applications: cups, can, lanyard, billboard" },
  ],
  about: [
    "The Squeeze Shop is a lemonade brand. It had to feel fun, energetic and family-friendly, and stay the same whether it's on a cup, a can, a sign or a screen.",
    "The look borrows from old rubber-hose cartoons: white gloves, big shoes, thick black outlines and a big grin.",
  ],
  challenge: {
    intro:
      "The brand needed a face people would remember and a system simple enough to repeat on every cup, can and sign, without losing its energy.",
    goals: [
      { title: "Be memorable", text: "Lead with a character, not just a logo, so the brand has a personality people recognize." },
      { title: "Feel retro, look fresh", text: "Use vintage cartoon style and lettering, with bright, modern colors." },
      { title: "Work on packaging", text: "Every piece had to hold up on cups, cans, merch and signs, at any size." },
    ],
  },
  approach: {
    steps: [
      {
        title: "The mascot",
        text: "A blue cup with a green lid and a bendy straw, drawn in rubber-hose style: white gloves, brown shoes, a wide grin. One hand gives a thumbs-up and the other holds a lemon.",
      },
      {
        title: "Logo and type",
        text: "“The Squeeze Shop” is set in Duckie, a soft, bubbly retro script, in a white box with a pink striped shadow. Obviously Regular handles everything else.",
      },
      {
        title: "Palette and pattern",
        text: "Five colors: black, Dodger Blue, French Pink, Lime Green and Yellow. A pattern of whole lemons, slices and halves fills backgrounds in pink or white.",
      },
      {
        title: "Brand sheet",
        text: "One page holds the mascot, the logo, the type, the color values (hex, RGB and CMYK) and the pattern, so anyone producing the brand has what they need.",
      },
      {
        title: "Packaging and applications",
        text: "The system went onto cups, a lanyard, a billboard and a full can label for Strawberry & Peach Lemonade.",
      },
    ],
  },
  showcase: [
    {
      title: "The mascot",
      text: "The cup is the brand. It shows up on every piece, from the billboard to the side of the can.",
      layout: "grid",
      images: [
        { src: `${IMG}/mascot.webp`, alt: "The Squeeze Shop mascot: a blue cup with a green lid, a bendy straw and a big grin, giving a thumbs-up and holding a lemon, in white gloves and brown shoes" },
        { src: `${IMG}/logo.webp`, alt: "The Squeeze Shop logo in a bubbly black retro script inside a white box with a pink striped shadow" },
      ],
    },
    {
      title: "Brand sheet",
      text: "Mascot, logo, typography, the SD monogram in three colors, the full palette with hex, RGB and CMYK values, and the lemon pattern, on one page.",
      layout: "wide",
      images: [
        { src: `${IMG}/brand-sheet.webp`, alt: "The Squeeze Shop brand sheet: the mascot on pink, the logo, typography (Duckie and Obviously Regular), the SD monogram in blue, pink and green, five color swatches with values, and a lemon pattern on pink" },
      ],
    },
    {
      title: "Lemon pattern",
      layout: "wide",
      images: [
        { src: `${IMG}/pattern-pink.webp`, alt: "Repeat pattern of yellow lemons, slices and halves with thick black outlines on French Pink" },
        { src: `${IMG}/banner.webp`, alt: "Wide banner with the mascot on the left and the logo on the right, over a faded pink lemon pattern" },
      ],
    },
    {
      title: "The can",
      text: "Strawberry & Peach Lemonade. The front leads with the SD monogram, a lemon slice and three “0” badges: added sugar, artificial flavors, preservatives. The back has the mascot, the ingredients in plain words and a nutrition panel.",
      layout: "wide",
      images: [
        { src: `${IMG}/can-label.webp`, alt: "Flat can label on pink: the mascot with speech bubbles about what's inside, the logo and SD monogram with “0” badges, “Strawberry & Peach Lemonade,” and a nutrition facts panel" },
        { src: `${IMG}/can-mockup.webp`, alt: "Two pink Strawberry & Peach Lemonade cans, one standing and one on its side, on a pale pink lemon pattern" },
        { src: "storage:projects/squeeze-shop/gallery/1.jpg", alt: "Rows of stacked pink Squeeze Shop cans showing the front and back of the label" },
      ],
    },
    {
      title: "Cups and merch",
      layout: "grid",
      images: [
        { src: `${IMG}/cups-mockup.webp`, alt: "Two clear plastic cups, one red and one yellow, each with The Squeeze Shop logo and mascot" },
        { src: "storage:projects/squeeze-shop/gallery/2.jpg", alt: "Lanyard printed with big yellow lemon slices on pink" },
      ],
    },
  ],
  design: {
    intro:
      "Bright, flat color, thick black outlines and rubber-hose cartoon style. Everything is drawn like it belongs in an old cartoon, but the colors are loud and modern.",
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "Dodger Blue", hex: "#2E79FF" },
      { name: "French Pink", hex: "#F969A4" },
      { name: "Lime Green", hex: "#2EFF85" },
      { name: "Yellow", hex: "#FED001" },
    ],
    type: "Duckie for titles: a soft, heavy retro script. Obviously Regular for body text.",
    patterns: [
      { title: "Thick black outlines", text: "Every shape, from the mascot to the lemons, has a heavy black line, so the art stays clear on any color." },
      { title: "The SD monogram", text: "A fat “S” beside a lemon slice shaped like a “D.” It comes in blue, pink and green and leads the front of the can." },
      { title: "Boxed logo", text: "The wordmark always sits in a white box with a pink striped shadow, so it reads on top of the busy pattern." },
    ],
  },
  timeline: [
    { when: "Apr 2025", title: "Identity", text: "The mascot, logo, palette, lemon pattern and brand sheet, with the billboard, cup and lanyard mockups." },
    { when: "May 2025", title: "Packaging", text: "The Strawberry & Peach Lemonade can label, can mockups and a white version of the pattern." },
  ],
  outcome: [
    "The Squeeze Shop has a character people can remember and a system that's easy to repeat: one mascot, one logo, five colors, two typefaces and a pattern.",
    "The mockups show it on cups, a can, a lanyard and a billboard, and the brand sheet has everything needed for the next piece.",
  ],
  stack: ["Illustrator", "Photoshop"],
};

export default study;
