// Search copy for the service pages: the <title> and description Google
// shows, what each service is called in structured data, and the FAQs at
// the bottom of each page.
//
// The FAQ answers and the longer "about" copy only restate what the service
// pages already say (timelines, deliverables, process). No prices,
// guarantees or claims were added — edit freely, but keep them true, since
// Google and AI assistants quote them as fact. Titles lead with the service
// and the place ("Custom Website Development in Dallas, TX"); the layout adds
// " | Thrive Creative Studios".

export type ServiceSlug = 'brand-design' | 'digital-design' | 'ux-design' | 'social-media' | 'photography';

export interface ServiceSeo {
  slug: ServiceSlug;
  path: string;
  /** Short name, used in breadcrumbs and structured data. */
  name: string;
  /** schema.org serviceType. */
  serviceType: string;
  /** Page <title>, before " | Thrive Creative Studios". */
  title: string;
  /** Meta description: what someone sees under the link on Google. */
  description: string;
  /** In-person work is DFW only; everything else is also remote. */
  remote: boolean;
  /** The longer read under the hero: what it is, what's included, who it's for. */
  about?: { heading: string; paragraphs: string[]; forWho: string[] };
  faqs: { q: string; a: string }[];
}

export const DFW_AREAS = ['Dallas', 'Fort Worth', 'Plano', 'Frisco', 'Arlington', 'Irving', 'Richardson', 'McKinney'];

const WHERE =
  'Thrive is based in Dallas and works with businesses across Dallas–Fort Worth, and with clients anywhere in the US remotely.';

export const SERVICE_SEO: Record<ServiceSlug, ServiceSeo> = {
  'brand-design': {
    slug: 'brand-design',
    path: '/services/brand-design',
    name: 'Branding',
    serviceType: 'Brand identity design',
    title: 'Branding & Logo Design in Dallas, TX',
    description:
      'Branding for Dallas small businesses from $450: a logo, colors and fonts, or a full identity with brand guidelines in 4 to 6 weeks. Remote across the US.',
    remote: true,
    about: {
      heading: 'BRANDING THAT MAKES YOU RECOGNIZABLE',
      paragraphs: [
        'Your brand is how people remember you after they scroll past, drive by or close the tab. A brand identity from Thrive gives you a logo, a color system and a typeface pairing that work together, plus the guidelines that keep them consistent wherever your business shows up — your website, your social accounts, your signage, your invoices.',
        'Every branding project starts with a discovery call about your goals, your customers and the feeling you want people to have when they see your name. From there you see two logo concepts, pick the one that feels most like you, and we refine it together: spacing, type, color and the layouts you will need.',
        'At the end you get your final files for print and web. A full identity adds an icon or secondary mark, a brand guidelines document, social media profile and cover images, and a business card design, and is yours in 4 to 6 weeks. The scope and price are agreed in a written proposal before any work starts.',
      ],
      forWho: [
        'New businesses that need a logo and a look before they launch',
        'Established businesses whose brand feels dated or no longer fits what they offer',
        'Founders tired of every post, flyer and page looking slightly different',
        'Businesses getting ready for a new website and want the brand right first',
      ],
    },
    faqs: [
      {
        q: 'How long does a brand identity take?',
        a: 'Most brand projects take 4–6 weeks, from the first discovery call to final files and brand guidelines.',
      },
      {
        q: 'What do I get at the end?',
        a: 'Logo and essentials includes a primary logo plus one alternate layout, a color palette and font pairing, and files for print and web. A full identity adds an icon or secondary mark, a brand guidelines document, social media profile and cover images, and a business card design.',
      },
      {
        q: 'How many logo concepts will I see?',
        a: 'Two logo concepts. You choose the one that feels most like you, and it is refined to final.',
      },
      {
        q: 'Do you only work with Dallas businesses?',
        a: WHERE,
      },
      {
        q: 'Is branding with Thrive affordable for a small business?',
        a: 'Thrive works with small businesses. Logo and essentials is $450, and a full identity is $800. You get a clear written proposal after the discovery call, before any work starts.',
      },
      {
        q: 'How much does branding cost?',
        a: 'Logo and essentials is $450. A full identity, with brand guidelines, social media profile and cover images and a business card design, is $800. Every project gets a clear written proposal before any work starts.',
      },
    ],
  },
  'digital-design': {
    slug: 'digital-design',
    path: '/services/digital-design',
    name: 'Web Development',
    serviceType: 'Custom website development',
    title: 'Custom Website Development in Dallas, TX',
    description:
      'Custom websites for Dallas small businesses from $750, with Starter, Medium and Large packages, monthly care plans, and builds on Wix, Shopify and Webflow.',
    remote: true,
    about: {
      heading: 'A WEBSITE THAT WORKS AS HARD AS YOU DO',
      paragraphs: [
        'For most small businesses, the website is the first real impression — it is where people go after they hear your name, see a post or find you on Google. Thrive designs and builds websites that make it obvious what you do, who you do it for and what to do next, whether that is booking a call, buying, or getting in touch.',
        'There are two ways to build. A custom-coded website is written from scratch for your business, so it can do exactly what you need: pages your team edits right on the site, forms that reach the right inbox, built-in analytics and search groundwork. Or Thrive designs and builds your site on the platform that fits you — Wix, Shopify, Webflow and others — so you can run it yourself day to day. Your proposal recommends one and explains why.',
        'Either way, the project starts with discovery and a page-by-page plan, then design with your colors, type and imagery, then the build, testing on phones and desktops, and launch. Every layout is designed mobile-first. If you already have a brand, it is carried through every page; if you don’t, branding can be part of the same project. The timeline and price are agreed in writing before work starts.',
      ],
      forWho: [
        'Small businesses without a website, or with one they’re embarrassed to send people to',
        'Businesses that need features a template can’t handle',
        'Shops and service businesses that want to run their site themselves on Wix, Shopify or Webflow',
        'Teams with a brand already that need it carried across every page',
      ],
    },
    faqs: [
      {
        q: 'Do you build custom websites or use platforms like Wix and Shopify?',
        a: 'Both. Thrive builds custom-coded websites written from scratch, and also designs and builds sites on Wix, Shopify, Webflow and other platforms. Your proposal recommends the right fit for what you need and how you want to run the site.',
      },
      {
        q: 'When is a custom website worth it?',
        a: 'When your site needs to do more than a template allows — for example, pages your staff edit right on the site, forms that route to different people, or built-in analytics. If you mainly need a clean site you can update yourself, a platform like Wix, Shopify or Webflow is often the better fit.',
      },
      {
        q: 'How long does a website take?',
        a: 'Starter sites are live in 2 to 3 weeks, Medium in 3 to 4 weeks and Large in 4 to 6 weeks. Custom builds get a timeline in their quote. Every project runs through discovery, design, the build, then launch.',
      },
      {
        q: 'Will my site work on phones?',
        a: 'Yes. Every layout is designed mobile-first and tested on phones and desktops before launch.',
      },
      {
        q: 'Can you build around the branding I already have?',
        a: 'Yes. Your existing colors, type and logo are carried through every page. If you don’t have a brand yet, branding can be part of the same project.',
      },
      {
        q: 'Is a website with Thrive affordable for a small business?',
        a: 'Website packages are $750 for Starter (3 to 5 pages), $950 for Medium (6 to 15 pages) and $1,150 for Large (16 to 25 pages). Sites that need more than pages are quoted. You get a written proposal with the timeline and price before anything starts, so there are no surprises.',
      },
      {
        q: 'Do you work with businesses outside Dallas?',
        a: WHERE,
      },
    ],
  },
  'ux-design': {
    slug: 'ux-design',
    path: '/services/ux-design',
    name: 'UX Design',
    serviceType: 'User experience design',
    title: 'UX Design for Apps & Websites in Dallas, TX',
    description:
      'Clickable app and website prototypes from $375, designed and ready to hand to your developer. UX design from a Dallas studio, available remotely.',
    remote: true,
    faqs: [
      {
        q: 'What does UX design include?',
        a: 'Every prototype includes screen-by-screen layouts for your app or site, a clickable prototype you can tap through on a phone or computer, two rounds of revisions, and design files handed off, ready for your developer. Up to 5 screens is $375 and up to 10 screens is $600.',
      },
      {
        q: 'How do you know the design works?',
        a: 'Designs are tested with real users. Feedback from those sessions is pulled together and the design is revised until it works for the people using it.',
      },
      {
        q: 'Do I need UX design or just a new look?',
        a: 'If people get lost, drop off, or keep asking how to do something, the problem is the experience, not the visuals. UX design starts by finding out where and why that happens.',
      },
      {
        q: 'Can you work with a remote team?',
        a: WHERE,
      },
    ],
  },
  'social-media': {
    slug: 'social-media',
    path: '/services/social-media',
    name: 'Social Media Management',
    serviceType: 'Social media management',
    title: 'Social Media Management in Dallas, TX',
    description:
      'Social media management for Dallas small businesses from $450/month: a monthly content calendar, designed posts and edited video, captions, scheduling and posting.',
    remote: true,
    about: {
      heading: 'SOCIAL MEDIA, HANDLED',
      paragraphs: [
        'Posting consistently and looking good doing it is a job in itself. Thrive’s social media management takes it off your plate: a month of content planned, designed, edited and written ahead of time, then posted on a consistent schedule.',
        'Each month you get a content calendar. Every post is designed, videos are edited, and captions and hashtags are written. You review and approve everything before it posts.',
        'Then Thrive schedules and posts it, so your accounts stay active without you thinking about it. Price depends on posts per week and the number of accounts. Filming and ad spend are not included. A monthly analytics report on reach, engagement and follower growth is available as an add-on.',
      ],
      forWho: [
        'Business owners who know they should post more but never have the time',
        'Brands whose feed doesn’t match the quality of what they actually do',
        'Businesses that want to post consistently without doing it themselves',
        'Teams that want to approve everything before it goes live',
      ],
    },
    faqs: [
      {
        q: 'What is included in social media management?',
        a: 'A monthly content calendar, graphic design and video editing for each post, captions and hashtags, and scheduling and posting. Filming and ad spend are not included. Monthly analytics reporting is available as an add-on.',
      },
      {
        q: 'Do I get to approve posts?',
        a: 'Yes. You review everything before it posts.',
      },
      {
        q: 'How do we start?',
        a: 'With an audit of your current accounts, your audience and what competitors are doing. That shapes the content pillars, voice and growth plan.',
      },
      {
        q: 'Do you only manage accounts for Dallas businesses?',
        a: WHERE,
      },
    ],
  },
  photography: {
    slug: 'photography',
    path: '/services/photography',
    name: 'Photography',
    serviceType: 'Brand and commercial photography',
    title: 'Brand Photography & Headshots in Dallas, TX',
    description:
      'Brand photography in Dallas–Fort Worth from $150: on-location brand sessions and full-day shoots, with edited photos delivered in an online gallery.',
    remote: false,
    faqs: [
      {
        q: 'Where do you shoot?',
        a: 'Photography sessions are in person across the Dallas–Fort Worth area.',
      },
      {
        q: 'How soon do I get my photos?',
        a: 'Your edited gallery is delivered within 7 days of the session, in web and print resolutions.',
      },
      {
        q: 'What kinds of photography do you offer?',
        a: 'Brand photography, headshots, product photography and event coverage, all retouched and edited.',
      },
      {
        q: 'Can I use the photos for my business?',
        a: 'Yes. Final images are delivered licensed for your use.',
      },
      {
        q: 'What happens before the shoot?',
        a: 'A consultation about your brand and the feel you want, then a shot list so the session has a clear plan for every frame.',
      },
    ],
  },
};
