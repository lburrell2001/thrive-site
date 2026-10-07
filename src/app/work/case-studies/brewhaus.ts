import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/brewhaus";

const study: CaseStudy = {
  slug: "brewhaus",
  client: "BrewHaus",
  headline: "A coffee brand built around one bean",
  lede:
    "BrewHaus is a branding and packaging project for a modern coffee brand. Thrive designed the identity from concept to execution: a wordmark with a coffee bean for the A, a lavender-and-espresso palette, a bean pattern, and the bags, cups, menu and sign that carry it.",
  meta: [
    { label: "Brand", value: "BrewHaus" },
    { label: "Type", value: "Coffee brand identity & packaging" },
    { label: "Thrive's role", value: "Brand design, packaging, mockups" },
    { label: "Year", value: "2025" },
  ],
  heroImage: {
    src: `${IMG}/bags-angled.webp`,
    alt: "Two BrewHaus coffee bags: a brown Night Shift dark roast and a lavender Morning Muse medium roast, with bean-pattern gussets",
  },
  numbers: [
    { value: "2", label: "Roasts with their own bag: Night Shift and Morning Muse" },
    { value: "5", label: "Colors in the brand guidelines" },
    { value: "4", label: "Menu sections: Haus Classics, Cold Sips, Specials, Bites" },
  ],
  about: [
    "BrewHaus is a coffee brand that balances bold personality with craft culture. The identity had to feel warm, expressive and easy to recognize on a shelf, on a cup and on a phone screen.",
    "Thrive took it from the first logo through the color system, packaging layouts and mockups, so every piece reads as the same brand.",
  ],
  challenge: {
    intro:
      "BrewHaus needed a look with shelf impact that also works in short-form content, and still says “coffee” at a glance.",
    goals: [
      { title: "Be recognizable fast", text: "One simple symbol that works as a logo, a pattern and a cup stamp." },
      { title: "Bold type and color", text: "A clear hierarchy so the brand name, roast name and flavor notes read in that order." },
      { title: "Room for more coffees", text: "A packaging system that new roasts can slot into without a redesign." },
    ],
  },
  approach: {
    steps: [
      { title: "Logo and mark", text: "A rounded, heavy wordmark with a two-tone coffee bean standing in for the A. The bean also works alone, set in a lavender circle as the logo mark." },
      { title: "Color and pattern", text: "Espresso browns, lavender (Thistle) and a soft gray, documented with HEX, RGB and CMYK values. A repeating pattern of tilted beans turns the mark into a surface." },
      { title: "Packaging", text: "Full bag dielines with the logo, roast name and flavor notes on the front, the bean pattern on the gussets, and the story, origin and brewing directions on the back." },
      { title: "Applications and mockups", text: "Paper cups, to-go cups, a café menu and a storefront sign, mocked up to show the system working in the real world." },
    ],
  },
  showcase: [
    {
      title: "Logo",
      text: "The primary wordmark, the bean logo mark, one-color versions of the name and the bean pattern.",
      layout: "wide",
      images: [
        { src: `${IMG}/logo-system.webp`, alt: "BrewHaus logo sheet: the brown BREWHAUS wordmark with a coffee bean as the A, the bean logo mark in a lavender circle, lavender and brown versions of the name, a single bean, and a lavender strip of the bean pattern" },
      ],
    },
    {
      title: "Packaging",
      text: "Each roast gets its own color: Night Shift (dark chocolate, molasses, hint of smoke) on brown, Morning Muse (cocoa, citrus and wildflower) on lavender. Both are 12 oz whole-bean bags. The back panel tells the BrewHaus story and lists origin, processing and brew suggestions, signed off with “Fuel your focus. Brew the vision.”",
      layout: "grid",
      images: [
        { src: `${IMG}/dieline-morning-muse.webp`, alt: "Flat dieline of the Morning Muse bag: lavender front with the logo and roast name, bean-pattern side panels, a dark brown base and the back panel with the brand story and brewing directions" },
        { src: `${IMG}/bag-and-cup.webp`, alt: "A lavender BrewHaus bag covered in the bean pattern with a large logo mark, next to a matching to-go cup" },
      ],
    },
    {
      title: "Cups",
      text: "The logo mark sits in a circle on every cup, with the bean pattern or a fine dot pattern around it.",
      layout: "grid",
      images: [
        { src: `${IMG}/paper-cups.webp`, alt: "BrewHaus paper espresso cups with the lavender bean pattern on an espresso machine drip tray, one being filled" },
        { src: `${IMG}/to-go-cups.webp`, alt: "Two BrewHaus to-go cups with lavender lids: one with a brown dot pattern, one cream with a bean-pattern sleeve, both carrying the bean logo mark" },
      ],
    },
    {
      title: "Menu and signage",
      text: "A lavender menu in the brand's bold type: Haus Classics, Cold Sips, house Specials like the Honeyhaus and Maplewood Latte, and Bites. Out front, the wordmark goes on a sign above the door.",
      layout: "grid",
      images: [
        { src: `${IMG}/menu.webp`, alt: "BrewHaus café menu on lavender with sections for Haus Classics, Cold Sips, Specials and Bites, framed in brown outlines with coffee bean graphics" },
        { src: `${IMG}/storefront-sign.webp`, alt: "Storefront sign reading BREWHAUS above a pair of wooden doors, with wall lamps on either side and leaf shadows on the wall" },
      ],
    },
  ],
  design: {
    intro:
      "Rich espresso browns against a soft lavender. The lavender makes the brand easy to spot; the browns keep it about coffee.",
    colors: [
      { name: "Wordmark brown", hex: "#5A2A0A" },
      { name: "Bistre", hex: "#3B1F0B" },
      { name: "Licorice", hex: "#1E0E05" },
      { name: "Thistle", hex: "#C8B8DB" },
      { name: "Platinum", hex: "#DFDBDC" },
      { name: "Black", hex: "#000000" },
    ],
    type: "A heavy, rounded sans-serif for the wordmark and roast names gives the brand a friendly, confident voice. Flavor notes and menu items sit underneath in a lighter weight.",
    patterns: [
      { title: "The bean as the A", text: "The coffee bean replaces a letter in the name, so the logo says what BrewHaus sells without a tagline." },
      { title: "Bean pattern", text: "Tilted beans repeat across bag gussets, cups and sleeves, so even a corner of the packaging is recognizable." },
      { title: "One color per roast", text: "Brown for the dark roast, lavender for the medium roast. The layout stays the same, so new roasts only need a new color and name." },
      { title: "Outlined shapes", text: "Thin black outlines around the beans and menu panels give everything a bold, illustrated feel." },
    ],
    fullPages: [
      { src: `${IMG}/brand-guidelines.webp`, alt: "BrewHaus brand guidelines sheet: primary logo, logo mark, five-color palette with HEX, CMYK and RGB values, packaging mockups and the bean pattern", caption: "Brand guidelines" },
    ],
  },
  timeline: [
    { when: "Mar 2025", title: "Brand guidelines", text: "Primary logo, logo mark, color palette, bean pattern and the first bag and cup mockups." },
    { when: "Jun 2025", title: "Packaging and menu", text: "Bag dielines for both roasts, the final bag mockups, the café menu and the finished logo sheet." },
  ],
  outcome: [
    "BrewHaus has a complete, consistent identity: a logo that explains itself, a palette that stands out on a coffee shelf, and a pattern that ties every piece together.",
    "The packaging is a system rather than a one-off. Adding a roast means choosing a color and writing the flavor notes; the logo, layout and pattern stay put.",
  ],
  stack: ["Illustrator", "Photoshop"],
};

export default study;
