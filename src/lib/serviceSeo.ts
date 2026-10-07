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
      'Affordable branding for Dallas small businesses: logo, colors, typography and brand guidelines, delivered as a complete identity in 4–6 weeks. Remote across the US.',
    remote: true,
    about: {
      heading: 'BRANDING THAT MAKES YOU RECOGNIZABLE',
      paragraphs: [
        'Your brand is how people remember you after they scroll past, drive by or close the tab. A brand identity from Thrive gives you a logo, a color system and a typeface pairing that work together, plus the guidelines that keep them consistent wherever your business shows up — your website, your social accounts, your signage, your invoices.',
        'Every branding project starts with a discovery call about your goals, your customers and the feeling you want people to have when they see your name. From there you see 2–3 distinct visual directions, pick the one that feels most like you, and we refine it together: spacing, type, color, every variation of the logo you will need.',
        'At the end you get a brand kit with every final file in PNG, SVG and PDF, brand guidelines that explain how to use it all, and ready-to-use social templates so your first posts already look like you. Most projects take 4–6 weeks from the first call to final files, and the scope and price are agreed in a written proposal before any work starts.',
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
        a: 'A primary logo with variations, a color system, typography, brand guidelines, social templates, and a brand kit with every final file in PNG, SVG and PDF.',
      },
      {
        q: 'How many logo concepts will I see?',
        a: 'You will see 2–3 distinct visual directions, choose the one that feels most like you, and then we refine it together.',
      },
      {
        q: 'Do you only work with Dallas businesses?',
        a: WHERE,
      },
      {
        q: 'Is branding with Thrive affordable for a small business?',
        a: 'Thrive works with small businesses, and each project is scoped to what you actually need — a logo refresh costs less than a full identity with guidelines and templates. You get a clear written proposal after the discovery call, before any work starts.',
      },
      {
        q: 'How much does branding cost?',
        a: 'It depends on what you need — a logo refresh is a smaller project than a full identity with guidelines and templates. Every project gets a clear written proposal after the discovery call, before any work starts.',
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
      'Custom-coded websites for Dallas small businesses, plus web design and builds on Wix, Shopify, Webflow and other platforms — designed around your brand, with a clear proposal up front.',
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
        a: 'It depends on the scope — a single landing page moves faster than a multi-page site. Your proposal includes a timeline before anything starts. Every project runs through discovery, design, the build, then launch.',
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
        a: 'Thrive works with small businesses, and each website is scoped to what you need — a single landing page is a smaller project than a multi-page site, and a platform build is usually smaller than a custom one. You get a written proposal with the timeline and price before anything starts, so there are no surprises.',
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
      'User research, wireframes, prototypes and usability testing for apps and websites — human-centered UX design from a Dallas studio, available remotely.',
    remote: true,
    faqs: [
      {
        q: 'What does UX design include?',
        a: 'User research, information architecture, wireframes, interactive prototypes, usability testing and a design system — whichever of those your product needs.',
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
      'Social media management for Dallas small businesses: strategy, a monthly content calendar, graphics, captions and community management, with a monthly analytics report.',
    remote: true,
    about: {
      heading: 'SOCIAL MEDIA, HANDLED',
      paragraphs: [
        'Posting consistently, looking good doing it and answering every comment is a job in itself. Thrive’s social media management takes it off your plate: a plan for what to post and why, a month of content designed and written ahead of time, and someone keeping an eye on your comments and messages.',
        'It starts with an audit of your current accounts, your audience and what your competitors are doing. That shapes your content pillars, your voice and a plan for how your accounts will grow. Each month you get a content calendar with designed graphics and captions, and you review and approve everything before it posts.',
        'Once posts are live, the work continues: replying to comments and DMs, engaging with your community, and a monthly analytics report that shows what is working, what is not and what changes next month. You also get reusable story templates, so you and your team can post on-brand in between.',
      ],
      forWho: [
        'Business owners who know they should post more but never have the time',
        'Brands whose feed doesn’t match the quality of what they actually do',
        'Businesses that want a plan and monthly numbers, not just pretty posts',
        'Teams that want to approve everything before it goes live',
      ],
    },
    faqs: [
      {
        q: 'What is included in social media management?',
        a: 'A content strategy, a content calendar, designed graphics and captions, story templates, community management, and a monthly analytics report.',
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
      'Brand photography, headshots, product and event photography in Dallas–Fort Worth — edited, licensed galleries delivered within 7 days.',
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
