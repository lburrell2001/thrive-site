import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/roots-to-wellness-social-media-management-graphics-creation";

const study: CaseStudy = {
  slug: "roots-to-wellness-social-media-management-graphics-creation",
  client: "Roots to Wellness Now",
  headline: "Wellness education people stop and read",
  lede:
    "Roots to Wellness is a Dallas nonprofit focused on youth and community healing. Thrive manages its Instagram and designs the posts: educational graphics on green space, food justice and community, plus reel-ready assets for events.",
  liveUrl: "https://www.instagram.com/rootstowellnessnow/",
  meta: [
    { label: "Client", value: "Roots to Wellness" },
    { label: "Industry", value: "Nonprofit · youth and community wellness" },
    { label: "Thrive's role", value: "Social media manager, graphic designer" },
    { label: "Year", value: "2026" },
  ],
  heroImage: {
    src: "/services/social/web/rootstowellnessnow-feed-01.jpg",
    alt: "Nine Roots to Wellness Instagram posts in a grid: green space for youth, a crate of radishes, “3 types of community,” planting, an Earth Day event post, “Earth justice is health justice” and “3 ways we are solving food injustice”",
  },
  numbers: [{ value: "9", label: "Feed posts in this set" }],
  about: [
    "Roots to Wellness is a Dallas 501(c)(3) working on youth and community healing, with the line “Healing communities from the roots up.”",
    "Its topics are serious ones: access to nature, food justice and how the systems that grow our food shape our health. The feed has to make them approachable without making them smaller.",
  ],
  challenge: {
    intro:
      "Roots to Wellness needed consistent publishing and clearer visuals, so its wellness guidance would come across the moment someone scrolled past.",
    goals: [
      { title: "Make education easy to take in", text: "Turn ideas like food justice and green space into a headline and a few short points." },
      { title: "Post consistently", text: "A recurring plan, so the account stays active between events." },
      { title: "Feel warm and grounded", text: "Gardens, hands in soil and fresh produce, in keeping with the organization's roots." },
      { title: "Bring people to events", text: "Event posts and reels that say what, when and where, with a QR code to sign up." },
    ],
  },
  approach: {
    steps: [
      { title: "A recurring content plan", text: "A repeating mix of educational posts, community posts and event promotion." },
      { title: "Educational graphics", text: "Each post leads with one clear statement, followed by a short list or a single supporting line." },
      { title: "A consistent visual hierarchy", text: "Big headline, then the supporting points, then the takeaway, on every post." },
      { title: "Reel-ready assets", text: "Vertical event graphics built to sit over video, with the event details and a QR code." },
    ],
  },
  showcase: [
    {
      title: "Feed posts",
      text: "Garden and community photography with bold type. Script accents (“3 types of,” “3 ways we are solving”) add warmth to heavy headlines.",
      layout: "posts",
      images: [
        { src: "/services/social/web/rootstowellnessnow-post-01.jpg", alt: "A man carrying a child on his shoulders down a wooded path: “Green space is not extra. It's essential for our youth.” with mental wellness, safe play, stronger communities and healthier futures, and “Access to nature is not a luxury, it's infrastructure.”" },
        { src: `${IMG}/post-earth-justice.webp`, alt: "Garden tools in soil under a white box: “Earth justice is health justice. The systems that grow our food shape our bodies.”" },
        { src: `${IMG}/post-food-injustice.webp`, alt: "A basket of tomatoes, onions and squash: “3 ways we are solving food injustice”" },
        { src: `${IMG}/post-community.webp`, alt: "Hands stacked together in a circle: “3 types of community”" },
        { src: `${IMG}/post-earth-day-event.webp`, alt: "Earth Day event post: “We love Earth Day. Be a part of the New Earth.” A gathering rooted in food justice, wellness and community, April 11, Dallas, with a QR code" },
        { src: `${IMG}/post-fresh-harvest.webp`, alt: "Gloved hands lifting radishes and greens into a wooden crate" },
        { src: `${IMG}/post-planting.webp`, alt: "Gloved hands planting a seedling in a terracotta pot" },
      ],
    },
    {
      title: "Event reel",
      text: "A vertical reel for an Earth Day gathering in Dallas. The event details and QR code stay on screen while the footage plays behind them.",
      layout: "phones",
      images: [
        { src: `${IMG}/reel-earth-day.webp`, alt: "Vertical reel frame of people gardening outdoors under “We love Earth Day, be a part of the New Earth,” with event details for April 11 in Dallas and a QR code" },
      ],
    },
  ],
  design: {
    intro:
      "The posts let the photography carry the mood (gardens, soil, produce and hands working together) and keep the type bold and direct so the message reads at a glance.",
    patterns: [
      { title: "Statement first", text: "Every post opens with one line that can stand alone, like “Access to nature is not a luxury, it's infrastructure.”" },
      { title: "Labels over photos", text: "Short points sit in white boxes over the photo so they stay readable on any image." },
      { title: "Script accents", text: "A handwritten script on top of heavy capitals softens serious topics." },
      { title: "Calls to action built in", text: "Event posts carry the date, the city and a QR code, so people can act straight from the feed." },
    ],
  },
  outcome: [
    "Roots to Wellness now has a cohesive educational feed and a predictable posting rhythm. Each post explains one idea clearly, and they all look like they come from the same organization.",
    "Event posts and reels give the community what it needs to show up: what's happening, when, where and how to sign up.",
  ],
  stack: ["Instagram", "Canva", "Adobe Photoshop"],
};

export default study;
