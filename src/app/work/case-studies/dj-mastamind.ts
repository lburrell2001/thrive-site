import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/dj-mastamind";

const study: CaseStudy = {
  slug: "dj-mastamind",
  client: "DJ Mastamind",
  headline: "A brain in headphones, built from the client's own sketch",
  lede:
    "DJ Mastamind came to Thrive with a notebook sketch and a name. Thrive turned it into a full identity: a logo with a mark, badge and wordmark, a repeat pattern, stickers, social posts and event posters.",
  meta: [
    { label: "Client", value: "DJ Mastamind" },
    { label: "Type", value: "DJ / music brand" },
    { label: "Thrive's role", value: "Brand design" },
    { label: "Timeline", value: "Apr – Nov 2025" },
  ],
  heroImage: {
    src: "storage:work/dj-mastamind-cover.jpg",
    alt: "Round Mastamind stickers scattered on a gray surface: the red brain with purple headphones on navy circles, and the full logo with the MASTAMIND wordmark on white circles",
  },
  numbers: [
    { value: "3", label: "Mood-board directions presented" },
    { value: "5", label: "Logo versions: lockup, mark, two badges, wordmark" },
    { value: "2", label: "Event posters" },
  ],
  about: [
    "DJ Mastamind is a DJ who needed a brand to carry across flyers, social posts and events. The name plays on “mastermind,” and the client already had a picture of the logo in mind.",
    "The project covered the logo and everything around it: colors, a repeat pattern, stickers, an Instagram look and posters for events.",
  ],
  challenge: {
    intro:
      "The client's sketch had the right idea: a brain, a cord and a wordmark. The job was to keep that idea and turn it into a logo that works small and large, on a phone screen, a sticker or a poster.",
    goals: [
      { title: "Keep the client's idea", text: "The brain and the cord came from the client's sketch, so they had to stay at the center of the logo." },
      { title: "Read at a glance", text: "Nightlife flyers and social posts are seen fast and often small. The logo needed bold shapes and high contrast." },
      { title: "Work as a system", text: "One mark had to stretch across a lockup, a badge, a pattern and posters without losing what makes it recognizable." },
    ],
  },
  approach: {
    intro: "The work moved from mood boards to concepts to a finished identity in about a month.",
    steps: [
      {
        title: "The client's sketch",
        text: "The starting point was a notebook drawing from the client: a brain under two spotlights, the name in record-like lettering and an aux cord running out of the brain.",
      },
      {
        title: "Three mood boards",
        text: "Thrive presented three directions, each with its own palette and a short note. One pulled from old-school hip-hop, house parties and streetwear in deep navy and brick red. One went for an intense late-night club feel in red, gray and black. One leaned trippy and after-hours in dark purple, black and white.",
      },
      {
        title: "Early concepts",
        text: "Two first drafts tested the idea in black and dark red: a brain wearing headphones, and a head silhouette filled with gears. Both carried the cord down into a rounded MASTAMIND wordmark.",
      },
      {
        title: "The final identity",
        text: "The brain won. It became bright red with white folds, wearing headphones with “MM” in the ear cup. The cord drops through a heavy navy-purple wordmark with a red outline and ends in a plug. The palette follows the navy-and-red mood board.",
      },
      {
        title: "Applications",
        text: "The logo was built into round badges, a repeat pattern, sticker and Instagram mockups, and posters, including one for the client's first annual event, Brainwave.",
      },
    ],
  },
  showcase: [
    {
      title: "From sketch to logo",
      text: "The client's drawing, the two early concepts and the final lockup. The brain, the headphones and the cord made it all the way through.",
      layout: "grid",
      images: [
        { src: `${IMG}/client-sketch.webp`, alt: "Ballpoint sketch on grid paper: a detailed brain under two spotlights, “MastaMind” in outlined lettering and an aux cord curling out of the brain, with handwritten notes", caption: "The client's sketch" },
        { src: `${IMG}/concept-brain.webp`, alt: "Early concept: a black brain with white folds wearing dark red headphones with “MM” in the ear cup, above a rounded black MASTAMIND wordmark", caption: "Early concept: the brain" },
        { src: `${IMG}/concept-head.webp`, alt: "Early concept: a black head silhouette filled with white gears, wearing dark red headphones, with the cord running down to a rounded MASTAMIND wordmark", caption: "Early concept: the head" },
        { src: `${IMG}/logo-primary.webp`, alt: "Final Mastamind logo: a red brain wearing black and purple headphones with “MM” in the ear cup, the cord running through a navy-purple MASTAMIND wordmark outlined in red", caption: "Final lockup" },
      ],
    },
    {
      title: "Logo system",
      text: "The mark works on its own, inside a navy badge, or in a white badge with the wordmark. Each keeps the same thick black-and-white outline, so it holds up small.",
      layout: "grid",
      images: [
        { src: `${IMG}/logo-mark.webp`, alt: "The Mastamind mark on its own: a red brain with white folds and a thick black outline, wearing headphones with “MM” in the ear cup" },
        { src: `${IMG}/logo-mark-badge.webp`, alt: "The Mastamind mark centered in a navy-purple circle with a black border" },
        { src: `${IMG}/logo-badge.webp`, alt: "White circular badge with a navy-purple border holding the full Mastamind logo and wordmark" },
      ],
    },
    {
      title: "Pattern",
      text: "The mark repeated in staggered rows on navy-purple. It fills social posts, sits behind the poster type and gives the brand a texture of its own.",
      layout: "wide",
      images: [
        { src: `${IMG}/brain-pattern.webp`, alt: "Repeat pattern of the red brain-and-headphones mark in staggered rows on a navy-purple background" },
      ],
    },
    {
      title: "Social and stickers",
      text: "An Instagram look that mixes the pattern with party and DJ photos, each stamped with the logo, plus stickers in both badge styles.",
      layout: "wide",
      images: [
        { src: "storage:projects/dj-mastamind/gallery/1.jpg", alt: "Three Instagram post mockups for DJ_MASTAMIND on a purple background: the logo badge over the brain pattern, a dancing crowd and hands on a DJ controller, each with the logo in the corner" },
      ],
    },
    {
      title: "Event posters",
      text: "“Brainwave,” DJ Mastamind's first annual event, set in giant black letters cut over a grainy crowd photo. A second poster stacks the name in three lines with the brain breaking through the type.",
      layout: "grid",
      images: [
        { src: `${IMG}/poster-brainwave.webp`, alt: "Black-and-white poster: “DJ Mastamind presents Brainwave,” huge black letters over a grainy crowd photo, with “First annual,” “June 12, 2025,” “Location TBA” and “Doors open at 8, 8PM – 12AM”" },
        { src: `${IMG}/poster-mastamind.webp`, alt: "Poster with MAS / TA / MIND stacked in navy-purple letters outlined in white and red, the brain-and-headphones mark breaking through the type over a dark brain pattern" },
      ],
    },
  ],
  design: {
    intro:
      "Bold, flat and high-contrast, built to stand out on dark flyers and small screens. Every shape gets a heavy outline, and the red brain is always the loudest thing on the page.",
    colors: [
      { name: "Brain red", hex: "#D42027" },
      { name: "Navy purple", hex: "#2D1560" },
      { name: "Black", hex: "#000000" },
      { name: "Headphone gray", hex: "#4D4E4E" },
      { name: "White", hex: "#FFFFFF" },
    ],
    type: "A heavy, wide, all-caps wordmark in navy-purple with a white inner line and a red outer outline, like a varsity jersey.",
    patterns: [
      { title: "The cord", text: "The headphone cord drops from the brain through the wordmark and ends in a plug, an idea carried over from the aux cord in the client's sketch." },
      { title: "MM in the ear cup", text: "The ear cup holds the client's initials, so even the smallest version of the mark carries the name." },
      { title: "Sticker outlines", text: "A thick black line and a white inner line around every shape make the logo read like a sticker on any background." },
    ],
  },
  timeline: [
    { when: "Apr 2025", title: "Mood boards and first concepts", text: "Three mood-board directions and two early logo concepts, built from the client's sketch." },
    { when: "May 2025", title: "Final logo and applications", text: "The final lockup, mark, badges and pattern, with sticker and Instagram mockups and the Brainwave poster." },
    { when: "Nov 2025", title: "Ongoing work", text: "The stacked-name Mastamind poster, set over the brain pattern." },
  ],
  outcome: [
    "DJ Mastamind went from a notebook sketch to a complete brand: a logo in five versions, a color palette, a repeat pattern and ready-made layouts for stickers, Instagram and posters.",
    "The client's own idea is still at the center of it. The brain, the headphones and the cord all came from that first drawing.",
  ],
  stack: ["Illustrator", "Photoshop"],
};

export default study;
