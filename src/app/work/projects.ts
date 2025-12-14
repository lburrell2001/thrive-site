// app/work/projects.ts

export type Project = {
  title: string;
  slug: string;
  category: string;
  span?: string;

  year?: string;
  role?: string;
  timeframe?: string;

  tagline: string;
  overview: string;
  highlights: string[];
  deliverables: string[];
  tools: string[];
  gallery?: string[];
};


export const WORK_PROJECTS: Project[] = [
  {
    title: "SafeSpace",
    slug: "safespace",
    category: "UX · Product · 3D",
    span: "span-5x6",
    tagline: "A calm, human-centered experience built to reduce friction and increase trust.",
    overview:
      "SafeSpace explores how thoughtful UX, clear hierarchy, and an intentional visual system can help users feel guided instead of overwhelmed. The product balances emotional sensitivity with structure, creating an experience that feels supportive rather than clinical.",
    highlights: [
      "End-to-end UX thinking from research to prototype",
      "Designed for clarity, comfort, and repeat usage",
      "Component-driven layout for scalability",
    ],
    deliverables: [
      "User flows",
      "Wireframes",
      "UI design",
      "Prototype",
      "Visual system",
    ],
    tools: ["Figma", "Illustrator", "After Effects"],
    gallery: ["01.jpg", "02.jpg", "03.jpg"],
  },

  {
    title: "BrewHaus",
    slug: "brewhaus",
    category: "Branding · Packaging",
    span: "span-4x4",
    tagline: "A bold coffee identity with packaging that feels collectible.",
    overview:
      "BrewHaus is a premium yet playful coffee brand designed to stand out both on shelf and on social. The visual system focuses on strong typography, confident color, and packaging that feels worthy of being shared, saved, and collected.",
    highlights: [
      "Flexible packaging system for future SKUs",
      "Bold type and color hierarchy",
      "Designed for shelf impact and short-form content",
    ],
    deliverables: [
      "Brand identity",
      "Packaging system",
      "Mockups",
      "Social assets",
    ],
    tools: ["Illustrator", "Photoshop"],
    gallery: ["01.jpg", "02.jpg"],
  },

  {
    title: "Curl & Co.",
    slug: "curl-and-co",
    category: "Branding · Visual System",
    span: "span-4x3",
    tagline: "A fresh, confident identity made to feel like self-care with personality.",
    overview:
      "Curl & Co. is a beauty brand system designed to feel uplifting, modern, and expressive. The visual language balances playful color with clean typography, allowing the brand to scale across packaging, social content, and future product launches.",
    highlights: [
      "Brand system built for growth",
      "Readable, expressive type pairing",
      "Social-first visual direction",
    ],
    deliverables: [
      "Brand identity",
      "Color and typography system",
      "Social templates",
    ],
    tools: ["Illustrator", "Figma"],
    gallery: ["01.jpg", "02.jpg"],
  },

  {
    title: "DJ Mastamind",
    slug: "dj-mastamind",
    category: "Branding · Music",
    span: "span-3x3",
    tagline: "A bold, high-energy identity for a DJ brand rooted in personality.",
    overview:
      "DJ Mastamind’s branding leans into rhythm, motion, and bold visual energy. The identity was built to translate seamlessly across digital flyers, social content, and event promotions while staying instantly recognizable.",
    highlights: [
      "High-contrast branding for nightlife environments",
      "Designed for motion and digital promotion",
      "Consistent visual language across platforms",
    ],
    deliverables: [
      "Logo design",
      "Brand visuals",
      "Social graphics",
      "Event flyers",
    ],
    tools: ["Illustrator", "Photoshop"],
    gallery: ["01.jpg"],
  },

  {
    title: "TCKT",
    slug: "tckt",
    category: "Product UX · UI",
    span: "span-4x3",
    tagline: "A smoother way to buy tickets—less chaos, more movie night.",
    overview:
      "TCKT simplifies the movie ticket purchasing experience by reducing steps, clarifying decisions, and designing UI patterns that feel fast and intuitive. The experience prioritizes ease without sacrificing personality.",
    highlights: [
      "Streamlined purchase and seat-selection flow",
      "UI patterns focused on speed and clarity",
      "Reduced decision fatigue for users",
    ],
    deliverables: [
      "User flows",
      "UI screens",
      "Interactive prototype",
    ],
    tools: ["Figma"],
    gallery: ["01.jpg", "02.jpg"],
  },

  {
    title: "The Squeeze Shop",
    slug: "squeeze-shop",
    category: "Branding · Mascot · Retro",
    span: "span-3x4",
    tagline: "A retro lemonade brand brought to life with character-led design.",
    overview:
      "The Squeeze Shop is a playful, retro-inspired lemonade and snack bar identity built around a rubberhose-style mascot. The brand leans nostalgic while staying flexible enough to expand into merch, packaging, and seasonal promotions.",
    highlights: [
      "Character-led branding for memorability",
      "Retro textures and bold typography",
      "Designed for packaging and merch",
    ],
    deliverables: [
      "Mascot design",
      "Brand identity",
      "Packaging mockups",
    ],
    tools: ["Illustrator", "Photoshop"],
    gallery: ["01.jpg", "02.jpg", "03.jpg"],
  },

  {
    title: "The Burrell Group",
    slug: "the-burrell-group",
    category: "Branding · Website",
    span: "span-4x4",
    tagline: "A modernized digital presence for a public engagement consultancy.",
    overview:
      "The Burrell Group project focused on refining the company’s digital presence to feel more modern, credible, and aligned with its impact-driven mission. The work balances professionalism with approachability.",
    highlights: [
      "Modernized visual direction",
      "Improved hierarchy and readability",
      "Designed for clarity and trust",
    ],
    deliverables: [
      "Website design",
      "Brand refinement",
      "Content layout",
    ],
    tools: ["Figma", "Wix"],
    gallery: ["01.jpg"],
  },

  {
    title: "Thrive Creative Studios",
    slug: "thrive-site",
    category: "Website · Development",
    span: "span-5x4",
    tagline: "A vibrant portfolio site built to sell the vibe and the value.",
    overview:
      "The Thrive Creative Studios website is both a portfolio and a statement. Designed and developed with a modular system, it allows projects to grow organically while maintaining a bold, cohesive visual identity.",
    highlights: [
      "Thrive-branded UI system",
      "Dynamic project routing",
      "Modular layout for easy scaling",
    ],
    deliverables: [
      "Design system",
      "Front-end development",
      "Project templates",
    ],
    tools: ["Next.js", "TypeScript", "CSS"],
    gallery: ["01.jpg"],
  },
];
