import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/thrive-social-media-management-graphics-creation";

const study: CaseStudy = {
  slug: "thrive-social-media-management-graphics-creation",
  client: "Thrive Creative Studios",
  headline: "A studio feed that shows the work and says what it believes",
  lede:
    "Thrive runs its own Instagram the way it would run a client's: a clear visual system, a set of repeatable post formats and a steady publishing rhythm. The feed explains how Thrive thinks about design, walks through real client projects and points people to the site.",
  liveUrl: "https://www.instagram.com/thrivecreativestudio_/",
  meta: [
    { label: "Client", value: "Thrive Creative Studios (in-house)" },
    { label: "Type", value: "Social media management and graphics" },
    { label: "Thrive's role", value: "Social media manager, graphic designer" },
    { label: "Year", value: "2026" },
  ],
  heroImage: {
    src: "/services/social/web/thrive-feed-01.jpg",
    alt: "Nine Thrive Instagram posts in a grid: a magnifying glass over “Your website isn't broken. It's just unclear.”, “Design is not decoration. It's problem-solving.”, “Why users leave websites”, a Valentine's Day post and “Confusion costs you money. Clarity is a growth strategy.”",
  },
  numbers: [
    { value: "3", label: "Client spotlight carousels" },
    { value: "6", label: "Slides in the website rebuild carousel" },
    { value: "4", label: "Post formats: feed posts, carousels, spotlights, stories" },
  ],
  about: [
    "Thrive Creative Studios is Lauren Burrell's Dallas design studio. It offers branding, web design, UX design, social media and photography.",
    "Instagram is where many small businesses first see Thrive's work, so the account has to do two jobs: show finished projects and make the case for clear, purposeful design.",
  ],
  challenge: {
    intro:
      "The account needed a clearer visual system and a more predictable posting rhythm, so people would recognize a Thrive post at a glance and know what to expect from the feed.",
    goals: [
      { title: "Look like one brand", text: "Every post should use the same colors, type and logo, whatever the topic." },
      { title: "Post on a rhythm", text: "A monthly content structure, so publishing doesn't depend on inspiration." },
      { title: "Show the thinking, not just the visuals", text: "Explain why design choices matter to a business, in plain words." },
      { title: "Turn finished work into content", text: "Every client project becomes a post series that shows the before, the process and the result." },
    ],
  },
  approach: {
    intro: "The work was split into a few post formats that repeat, each with its own job.",
    steps: [
      { title: "Monthly content structure", text: "A plan for each month that mixes point-of-view posts, client work, stories and seasonal posts." },
      { title: "Point-of-view posts", text: "Single-image posts with one short idea each: clarity over decoration, questions before visuals, messaging over trends." },
      { title: "Client spotlights", text: "Multi-slide carousels that walk through a client's brief, logo, visual language and final product." },
      { title: "Case-study carousels", text: "A website rebuild told slide by slide: where the client started, where they are now and what they can do themselves." },
      { title: "Stories", text: "Vertical graphics for quick tips, today's creation and calls to work with Thrive." },
    ],
  },
  showcase: [
    {
      title: "Point-of-view posts",
      text: "Short, bold statements about what makes design work. Each one carries the Thrive logo and the same palette, so the feed reads as one voice.",
      layout: "posts",
      images: [
        { src: `${IMG}/post-unclear-messaging.webp`, alt: "Blue grid post: “The real issue isn't how modern your website looks. It's unclear messaging.”" },
        { src: `${IMG}/post-what-we-look-at-first.webp`, alt: "“What we look at first” post with three checked questions: What problem are we solving? Who is this for? What should users do next? and the line “Questions before visuals.”" },
        { src: `${IMG}/post-good-design-direction.webp`, alt: "Purple post: “Good design isn't decoration. It's direction.”" },
        { src: `${IMG}/post-stop-sign.webp`, alt: "A stop sign reading “Stop sending people to that website,” with signs saying “If it doesn't convert, it's hurting you” and “Click the link in my bio to work with Thrive”" },
        { src: `${IMG}/post-design.webp`, alt: "The word “DESIGN” in heavy white letters on blue with the Thrive mark below" },
        { src: `${IMG}/post-valentines.webp`, alt: "Magenta Valentine's Day post from Thrive Creative Studios with purple and green outlined hearts" },
      ],
    },
    {
      title: "Website rebuild carousel",
      text: "Six slides on Thrive's rebuild of The Burrell Group's website: the template site they started with, the custom site they have now, how staff edit it and who visits.",
      layout: "posts",
      images: [
        { src: `${IMG}/tbg-01-template-to-custom.webp`, alt: "Carousel slide: “From template to custom: The Burrell Group website rebuild” above a laptop showing the new home page" },
        { src: `${IMG}/tbg-02-where-they-started.webp`, alt: "Carousel slide: “Where they started” with the old template website on a laptop" },
        { src: `${IMG}/tbg-03-where-they-are-now.webp`, alt: "Carousel slide: “Where they are now” with the new custom home page on a laptop" },
        { src: `${IMG}/tbg-04-they-run-it.webp`, alt: "Carousel slide: “They run it themselves,” showing the on-page editor, with a note that staff edit headlines and photos without a developer" },
        { src: `${IMG}/tbg-05-who-is-looking.webp`, alt: "Carousel slide: “They see who's looking,” showing the dashboard of organizations that visit the site" },
        { src: `${IMG}/tbg-06-keeping-up.webp`, alt: "Carousel slide: “Is your site keeping up with you? Custom websites for small businesses. Link in bio · @thrivecreativestudio_”" },
      ],
    },
    {
      title: "Client spotlights",
      text: "Each spotlight walks through one project, from the client's idea to the finished brand or product: Mastamind's logo, the SoulCheck app and the Classic Rollers car club website.",
      layout: "posts",
      images: [
        { src: `${IMG}/spotlight-mastamind-01.webp`, alt: "“Client spotlight” cover slide with the Mastamind brain-and-headphones logo over a black-and-white concert crowd" },
        { src: `${IMG}/spotlight-mastamind-03.webp`, alt: "Mastamind slide comparing the client's notebook sketch with the final logo" },
        { src: `${IMG}/spotlight-soulcheck-01.webp`, alt: "SoulCheck client spotlight slide labeled “Branding & UX Design,” with the app's mood-tracking screens on two phones" },
        { src: `${IMG}/spotlight-soulcheck-02.webp`, alt: "SoulCheck slide “The brief: Thoughtful. Layered. Real.” with a mood board of green landscapes, stacked stones and app screens" },
        { src: `${IMG}/spotlight-classic-rollers-01.webp`, alt: "Classic Rollers slide: “Designing a website for a car club with real personality” beside a blue classic muscle car" },
        { src: `${IMG}/spotlight-classic-rollers-04.webp`, alt: "Classic Rollers slide listing what Thrive focused on: clear navigation, strong visual identity, mobile-friendly design and easy access to events and membership" },
      ],
    },
    {
      title: "Introducing the studio",
      text: "A carousel that explains what Thrive does, one service per slide, using real projects: the Ctrl + Sound logo, the TCKT and SoulCheck apps and The Burrell Group website.",
      layout: "posts",
      images: [
        { src: `${IMG}/intro-01.webp`, alt: "Magenta circle with the Thrive logo: “We design, build, and elevate brands that work beautifully everywhere they live.”" },
        { src: `${IMG}/intro-02.webp`, alt: "Branding slide with the Ctrl + Sound logo on a tote bag and a sign: “From logos to content systems, we craft visual identities that stay consistent across platforms.”" },
        { src: `${IMG}/intro-03.webp`, alt: "UX slide with the TCKT ticketing app and SoulCheck app on phones: “User focused interfaces built around clarity, flow, and function.”" },
        { src: `${IMG}/intro-04.webp`, alt: "Web slide with The Burrell Group site on a laptop: “We design and build — custom, responsive, and ready to grow.”" },
      ],
    },
    {
      title: "Stories",
      text: "Vertical graphics for quick, everyday posts: a tip, today's creation, a new logo or a nudge to work with Thrive.",
      layout: "phones",
      images: [
        { src: "/services/social/web/thrive-story-01.jpg", alt: "Story graphic of a hand holding a phone with the SoulCheck app on a green background, signed with the Thrive logo" },
        { src: `${IMG}/story-stop-sign.webp`, alt: "Story version of the stop-sign graphic: “Stop sending people to that website”" },
        { src: `${IMG}/story-todays-creation.webp`, alt: "Orange “Today's creation” story showing Brew House coffee bag packaging" },
        { src: `${IMG}/story-quick-tip.webp`, alt: "Purple “Quick tip” story with an orange light bulb" },
        { src: `${IMG}/story-logo-design.webp`, alt: "“Logo design” story with the Ctrl + Sound logo printed on a tote bag" },
      ],
    },
  ],
  design: {
    intro:
      "The feed uses Thrive's own brand system: saturated blue, magenta, purple, orange and mint, heavy display type and the pencil “i” in the logo. Bright color and short statements make a post recognizable before anyone reads the name.",
    colors: [
      { name: "Thrive blue", hex: "#3b43af" },
      { name: "Magenta", hex: "#d12e83" },
      { name: "Purple", hex: "#861dc5" },
      { name: "Orange", hex: "#ea6b2c" },
      { name: "Mint", hex: "#71f082" },
      { name: "Black", hex: "#000000" },
    ],
    patterns: [
      { title: "One idea per post", text: "A single statement, set big, with one or two words picked out in a second color." },
      { title: "Real work as proof", text: "Client sites and apps appear on laptops and phones, so every claim is backed by a project." },
      { title: "Grids and stars", text: "A drafting grid and star shapes tie single posts, carousels and stories together." },
      { title: "A call to action", text: "Posts end by pointing to the link in bio or the website." },
    ],
  },
  outcome: [
    "Thrive's feed now looks like one brand and runs on a plan, not on whenever there's time. Point-of-view posts, client spotlights, case-study carousels and stories each have a set format, so new posts are quicker to make and easy to recognize.",
    "It's also the same system Thrive offers clients: a monthly content structure and branded post and story templates.",
  ],
  stack: ["Instagram", "Canva", "Adobe Photoshop"],
};

export default study;
