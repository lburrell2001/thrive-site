// Search copy for the service pages: the <title> and description Google
// shows, what each service is called in structured data, and the FAQs at
// the bottom of each page.
//
// The FAQ answers only restate what the service pages already say
// (timelines, deliverables, process). No prices, guarantees or claims were
// added — edit freely, but keep answers true, since Google and AI
// assistants quote them as fact.

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
  faqs: { q: string; a: string }[];
}

export const DFW_AREAS = ['Dallas', 'Fort Worth', 'Plano', 'Frisco', 'Arlington', 'Irving', 'Richardson', 'McKinney'];

const WHERE =
  'Thrive is based in Dallas and works with businesses across Dallas–Fort Worth, and with clients anywhere in the US remotely.';

export const SERVICE_SEO: Record<ServiceSlug, ServiceSeo> = {
  'brand-design': {
    slug: 'brand-design',
    path: '/services/brand-design',
    name: 'Brand Design',
    serviceType: 'Brand identity design',
    title: 'Brand Identity & Logo Design in Dallas, TX',
    description:
      'Logos, color systems, typography and brand guidelines for Dallas businesses — a complete brand identity in 4–6 weeks. Remote projects across the US.',
    remote: true,
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
        q: 'How much does branding cost?',
        a: 'It depends on what you need — a logo refresh is a smaller project than a full identity with guidelines and templates. Every project gets a clear written proposal after the discovery call, before any work starts.',
      },
    ],
  },
  'digital-design': {
    slug: 'digital-design',
    path: '/services/digital-design',
    name: 'Digital Design',
    serviceType: 'Website and landing page design',
    title: 'Website & Landing Page Design in Dallas, TX',
    description:
      'Website design, landing pages and digital assets for Dallas businesses — strategy-led, mobile-first, and delivered in 2–4 weeks. Remote projects across the US.',
    remote: true,
    faqs: [
      {
        q: 'How long does a website design take?',
        a: 'Most website and landing page designs take 2–4 weeks: discovery, wireframes, full visual design, then handoff.',
      },
      {
        q: 'Will my site work on phones?',
        a: 'Yes. Every layout is designed mobile-first, so it works on a phone before it is stretched to a desktop.',
      },
      {
        q: 'Can you design around the branding I already have?',
        a: 'Yes. Brand implementation is part of the work — your existing colors, type and logo carried through every page.',
      },
      {
        q: 'What do I receive at handoff?',
        a: 'Final Figma files, exported assets and specs, ready for development or launch. If you also need the site built, say so when you reach out and it will be included in your proposal.',
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
    title: 'UX & Product Design in Dallas, TX',
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
    title: 'Social Media Management & Content in Dallas, TX',
    description:
      'Content strategy, graphics, captions and community management for Dallas businesses — social media that grows your audience, with monthly analytics.',
    remote: true,
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
