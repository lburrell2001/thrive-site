import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/dallas-derby-day";
const G = "storage:projects/dallas-derby-day/gallery";

const study: CaseStudy = {
  slug: "dallas-derby-day",
  client: "Dallas Derby Day",
  headline: "Eleven days of graphics for a day at the races",
  lede:
    "Dallas Derby Day is a hospitality event at Lone Star Park in Grand Prairie, built around racing, fashion and a dressed-up afternoon. Thrive was its design team for the final stretch before the May 2, 2026 event: feed graphics, partner and vendor spotlights, and short countdown videos, all in one look.",
  meta: [
    { label: "Client", value: "Dallas Derby Day" },
    { label: "Type", value: "Event social media campaign" },
    { label: "Thrive's role", value: "Social media manager & graphic designer" },
    { label: "Timeline", value: "Apr 21 – May 2, 2026" },
  ],
  heroImage: {
    src: "storage:work/dallas-derby-day-cover.jpg",
    alt: "Two phones showing the dallasderbyday Instagram profile and its grid of event posts, over blurred campaign graphics",
  },
  numbers: [
    { value: "+25%", label: "Event sign-ups" },
    { value: "11", label: "Days from proposal to event day" },
    { value: "6", label: "Vertical videos: countdowns and promos" },
    { value: "3", label: "Partner and vendor spotlights" },
  ],
  about: [
    "Dallas Derby Day brings a day of racing, fashion and premium hospitality to Lone Star Park in Grand Prairie, Texas. Guests dress for it: wide-brim hats, fascinators, tailored suits.",
    "The 2026 event was on May 2. Thrive came on 11 days before, on April 21, to produce the creative for the campaign that would bring guests in.",
  ],
  challenge: {
    intro:
      "With less than two weeks to go, the event needed a steady stream of posts that looked like they belonged together and made people want to be there.",
    goals: [
      { title: "Look as polished as the event", text: "Every post should feel like a dressed-up afternoon at the track, not a generic event flyer." },
      { title: "Stay consistent at speed", text: "New graphics every few days, across feed posts and vertical video, without the look drifting." },
      { title: "Give partners their moment", text: "Sponsors and vendors needed posts of their own that still read as Dallas Derby Day." },
      { title: "Build urgency", text: "A countdown to May 2 that kept the date and the website in front of people." },
    ],
  },
  approach: {
    intro: "The work followed the plan in Thrive's proposal: set the direction first, then deliver in batches as the campaign ran.",
    steps: [
      { title: "Visual direction", text: "A mood board titled “Black Old Money Spring Aesthetic”: garden parties, polo grounds, linen suits, hats and editorial fashion. It set the tone for every post." },
      { title: "One template system", text: "Event photos under a dark overlay, white serif headlines with one gold phrase, and the event's web address at the bottom of every graphic." },
      { title: "Feed graphics", text: "Square and portrait posts for the feed: the venue, live music, and a short countdown poem ending in the date." },
      { title: "Partner and vendor spotlights", text: "Posts for the ALTO ride partnership, a “Meet the vendor” feature for The Sweet Doctor, and a Flecha Azul Tequila × The Cigar Bar Experience pairing." },
      { title: "Countdown and promo videos", text: "Short 9:16 clips filmed at the track with a days-left counter, plus promo clips for the venue and the cigar bar." },
    ],
  },
  showcase: [
    {
      title: "Feed graphics",
      text: "One look across every post: real event photography, a dark overlay, white serif type and a single gold phrase.",
      layout: "posts",
      images: [
        { src: `${G}/1780512808911-April24-LoneStarParkRunwayGraphic.png`, alt: "Black-and-white photo of the Lone Star Park track and picnic tables with the headline “Lone Star Park is our runway.”, “runway” in gold" },
        { src: `${G}/1780512810076-April23-LiveMusicGraphic.png`, alt: "A singer in a green fascinator at the microphone under the words “Live music. Good vibes. Derby done right.”" },
        { src: `${G}/1780512806854-April25-somewhereindallasGraphic.png`, alt: "A guest in a yellow dress and veiled hat behind the text “somewhere in dallas a hat is being pressed. an outfit is being laid out. a ticket is being purchased. may 2nd.”" },
      ],
    },
    {
      title: "Partner and vendor spotlights",
      text: "Sponsors and vendors got posts of their own, built on the same template so they still read as Dallas Derby Day.",
      layout: "posts",
      images: [
        { src: `${G}/1780512805545-ALTOGraphic.png`, alt: "Jockeys on horseback behind a white ALTO car, with the headline “Arrive in style with our partner”" },
        { src: `${G}/1780512807971-April24-TheSweetDoctor-VendorSpotlight.png`, alt: "Vendor spotlight: a baker in a pink chef's coat with a tray of cupcakes, captioned “Meet The Sweet Doctor, Curing Your Sweet Tooth”" },
        { src: `${IMG}/post-perfect-pair.webp`, alt: "A cigar resting on a glass of tequila with “Experience the perfect pair on the perfect Derby Day” and the Flecha Azul Tequila × The Cigar Bar Experience logos" },
      ],
    },
    {
      title: "Countdown and promo videos",
      text: "Short vertical clips filmed at the track, each stamped with the days left, the web address and Grand Prairie, TX.",
      layout: "phones",
      images: [
        { src: `${IMG}/reel-countdown-9-days.webp`, alt: "Still from a vertical video: horses racing down the track with a gold “09. Days left” counter" },
        { src: `${IMG}/reel-track-is-ready.webp`, alt: "Still from a vertical video: the Lone Star Park track and big screen with the words “The track is ready for you”" },
        { src: `${IMG}/reel-countdown-1-day.webp`, alt: "Still from a vertical video: two guests in derby hats and sunglasses with a gold “01. Days left” counter" },
      ],
    },
  ],
  design: {
    intro:
      "Dark, warm and editorial, like a fashion magazine spread at the racetrack. The proposal set the palette as deep black grounds with champagne gold and ivory type.",
    type: "A heavy serif in capitals for headlines, with a lighter lowercase serif for the slower, poetic posts.",
    patterns: [
      { title: "One gold phrase", text: "Each headline has one phrase in gold to carry the message: “runway,” “Derby done right,” “partner.”" },
      { title: "Real event photos", text: "Guests, performers and the track at Lone Star Park, dimmed so the type stays readable." },
      { title: "The address on everything", text: "DALLASDERBYDAY.COM sits at the bottom of every graphic and video, so every post points to tickets." },
      { title: "A countdown that repeats", text: "The same big gold number, “Days left” and location stack on every countdown clip, so the series is recognizable at a glance." },
    ],
  },
  timeline: [
    { when: "Apr 21, 2026", title: "Proposal", text: "Scope, visual direction and sample post formats for the campaign." },
    { when: "Apr 23", title: "First batch", text: "The live music graphic and the first countdown video, 9 days out." },
    { when: "Apr 24 – 25", title: "Venue and vendors", text: "“Lone Star Park is our runway,” The Sweet Doctor spotlight and “somewhere in dallas.”" },
    { when: "Apr 28", title: "Partners and promos", text: "The ALTO partner post, the Flecha Azul × Cigar Bar pairing and two promo videos." },
    { when: "May 1", title: "Final countdown", text: "The one-day-left video." },
    { when: "May 2, 2026", title: "Event day", text: "Dallas Derby Day at Lone Star Park." },
  ],
  outcome: [
    "Dallas Derby Day went into event day with a campaign that looked like one thing: the same type, colors and photo treatment on every post, from the venue to the vendors to the final countdown. Event sign-ups rose 25%.",
    "The client said they intend to keep working with Thrive on future events.",
  ],
  stack: ["Adobe Express", "Illustrator", "Photoshop", "Google Drive"],
};

export default study;
