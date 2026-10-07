// Prices for each service page, rendered by ServicePricing. This is the one
// place to change a price: the service pages, the "From" line on /services and
// each page's meta description (serviceSeo.ts) all read from here.
//
// Rule: never show an hourly rate anywhere on the site.

import type { ServiceSlug } from './serviceSeo';

export type PriceCard = {
  name: string;
  price: string;
  /** One line under the price: size, timing or who it's for. */
  scope?: string;
  items?: string[];
  /** Defaults to a "Get started" link to /contact. */
  cta?: { label: string; href: string };
  /** A second, quieter link, e.g. to a case study. */
  link?: { label: string; href: string };
};

export type PriceSection = {
  id: string;
  heading: string;
  intro?: string;
  cards: PriceCard[];
  /** A list shared by every card, e.g. what every prototype includes. */
  includes?: { heading: string; items: string[] };
  addOns?: PriceCard[];
  /** Small print under the section. */
  notes?: string[];
};

export type ServicePricing = {
  /** Shown on the /services overview card. */
  from: string;
  sections: PriceSection[];
};

export const SERVICE_PRICING: Record<ServiceSlug, ServicePricing> = {
  'digital-design': {
    from: 'From $750',
    sections: [
      {
        id: 'packages',
        heading: 'Website packages',
        cards: [
          {
            name: 'Starter',
            price: '$750',
            scope: '3 to 5 pages · Live in 2 to 3 weeks',
            items: [
              'Custom design in your colors and fonts, not a template',
              'Works on phones, tablets, and desktops',
              'Click-to-call, email, and contact buttons',
              'Secure (lock icon) and launched on your domain',
              'Page titles and descriptions set up for Google',
              'One round of revisions',
              'You provide the text and photos',
            ],
          },
          {
            name: 'Medium',
            price: '$950',
            scope: '6 to 15 pages · Live in 3 to 4 weeks',
            items: [
              'Everything in Starter',
              'A separate page for each service',
              'Photo gallery or project portfolio',
              'Contact form that emails you',
              'Google map and reviews link',
              'One round of revisions',
            ],
          },
          {
            name: 'Large',
            price: '$1,150',
            scope: '16 to 25 pages · Live in 4 to 6 weeks',
            items: [
              'Everything in Medium',
              'Admin area so your team can edit text and photos',
              'Inbox for form submissions',
              'A walkthrough showing your staff how to update the site',
              'Two rounds of revisions',
            ],
          },
          {
            name: 'Custom',
            price: 'Contact for pricing',
            scope: 'For sites that need more than pages',
            items: [
              'Motion graphics and animation',
              'Visitor dashboard showing which organizations view your site',
              'Vendor, registration, or application forms with a database',
              'Client portals, logins, or online payments',
            ],
            cta: { label: 'Contact us', href: '/contact' },
            link: { label: 'See a custom build: The Burrell Group', href: '/work/the-burrell-group' },
          },
        ],
        addOns: [
          {
            name: 'Add-on: Prototype first',
            price: '$200 ($300 on Large)',
            scope: 'See and click through the design before we build',
            items: [
              'Clickable prototype of the homepage and one inner page',
              'One round of changes before the build starts',
              'Included in every Custom quote',
            ],
          },
        ],
        notes: [
          'Hosting is billed through Thrive during the build. At launch, the hosting account transfers to you and you pay the hosting company directly.',
        ],
      },
      {
        id: 'care',
        heading: 'Care plans',
        intro: 'Keep your site secure, backed up, and up to date after launch.',
        cards: [
          {
            name: 'Basic care',
            price: '$55/month',
            scope: 'For Starter and Medium sites',
            items: [
              'We manage your hosting account for you (you pay the hosting company directly)',
              'Security certificate kept active',
              'Security and software updates',
              'Monthly backups',
              'Up to one hour of small edits each month (text, photos, hours, a new staff bio)',
              'Requests handled within two business days',
            ],
          },
          {
            name: 'Plus care',
            price: '$75/month',
            scope: 'For Large sites with an admin area',
            items: [
              'Everything in Basic',
              'Database backups',
              'Admin area kept working and up to date',
              'Up to two hours of edits or help each month',
              'A security check each quarter',
            ],
          },
          {
            name: 'Custom care',
            price: 'From $200/month',
            scope: 'For Custom builds',
            items: [
              'Everything in Plus',
              'Dashboard, forms, and logins kept running',
              'Up to five hours of changes each month',
              'Priority response',
              'Quoted to match the build',
            ],
          },
        ],
        notes: [
          'Unused hours do not carry over to the next month.',
          'Work beyond the included time is quoted before it starts.',
          'Billed monthly through your client portal. Six-month minimum.',
        ],
      },
    ],
  },
  'brand-design': {
    from: 'From $450',
    sections: [
      {
        id: 'packages',
        heading: 'Brand packages',
        cards: [
          {
            name: 'Logo and essentials',
            price: '$450',
            items: [
              'Two logo concepts, one refined to final',
              'Primary logo plus one alternate layout',
              'Color palette and font pairing',
              'Files for print and web',
            ],
          },
          {
            name: 'Full identity',
            price: '$800',
            scope: 'Yours in 4 to 6 weeks',
            items: [
              'Everything in Logo and essentials',
              'Icon or secondary mark',
              'Brand guidelines document',
              'Social media profile and cover images',
              'Business card design',
            ],
          },
        ],
      },
    ],
  },
  'social-media': {
    from: 'From $450/month',
    sections: [
      {
        id: 'packages',
        heading: 'Pricing',
        cards: [
          {
            name: 'Social media management',
            price: '$450 to $800/month',
            scope: 'Price depends on posts per week and number of accounts',
            items: [
              'Monthly content calendar',
              'Graphic design and video editing for each post',
              'Captions and hashtags',
              'Scheduling and posting',
              'Not included: filming and ad spend',
            ],
          },
        ],
        addOns: [
          {
            name: 'Add-on: Analytics reporting',
            price: '$100 to $200/month',
            items: [
              'Monthly report on reach, engagement, and follower growth',
              'What worked and what to post next',
            ],
          },
        ],
      },
    ],
  },
  'ux-design': {
    from: 'From $375',
    sections: [
      {
        id: 'packages',
        heading: 'Pricing',
        intro: 'App and website prototypes, designed and ready to hand to your developer.',
        cards: [
          { name: 'Prototype, up to 5 screens', price: '$375' },
          { name: 'Prototype, up to 10 screens', price: '$600' },
          { name: 'More than 10 screens', price: 'Contact for pricing', cta: { label: 'Contact us', href: '/contact' } },
        ],
        includes: {
          heading: 'Every prototype includes:',
          items: [
            'Screen-by-screen layouts for your app or site',
            'A clickable prototype you can tap through on a phone or computer',
            'Two rounds of revisions',
            'Design files handed off, ready for your developer',
          ],
        },
      },
    ],
  },
  photography: {
    from: 'From $150',
    sections: [
      {
        id: 'packages',
        heading: 'Pricing',
        cards: [
          {
            name: 'Brand session',
            price: '$150',
            scope: 'Up to 3 hours on location',
            items: ['About 15 edited photos, delivered in an online gallery'],
          },
          {
            name: 'Full day',
            price: '$350',
            scope: 'Up to 6 hours',
            items: ['About 40 edited photos, multiple setups or locations'],
          },
        ],
      },
    ],
  },
};
