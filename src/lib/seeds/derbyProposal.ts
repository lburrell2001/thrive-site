// Dallas Derby Day 2026 — the reference proposal, as data.
//
// Reconstructed from DallasDerbyDay_Proposal_Final.pdf (scope, phases, next
// steps, visual direction, sample graphics) plus the Investment & Pricing
// page from DallasDerbyDay_Proposal_v4.pdf, which the Final export dropped.
//
// Copy fixes applied here, so they never reach a client-facing template:
//   * "REFFERAL"                    -> "Referral"
//   * Phase 6 "Amplify" reuses      -> given its own description
//     Phase 5's body copy
//   * "Aprill 22 - Day 1"           -> "April 22 — Day 1"
//   * "WHAT HAPPENS AFTER APRROVAL" -> "AFTER APPROVAL"
//   * "gold and ivory type"         -> kept, but attributed to the Dallas
//     Derby Day palette on the previous page. It was never a contradiction:
//     ivory/champagne is the CLIENT's asset palette; lime and orange are
//     Thrive's proposal chrome. The copy now says which is which.
//   * "video content she films herself" -> "you film yourself". The source
//     talks about the reader in the third person in a document addressed
//     to her.
//   * "The event is May 2nd. 10 days away." -> day count dropped. April 21
//     to May 2 is 11 days, which is what the cover says; a hard-coded day
//     count goes stale the moment the proposal is reused.
//
// IDs are fixed so the seed is idempotent and so storage paths
// (proposals/{proposal_id}/{block_id}/{file}) are stable across re-runs.

import type { ProposalBlock, ProposalTheme } from '@/types/proposal';

export const DERBY_PROPOSAL_ID = 'd0000000-0000-4000-8000-000000000001';
export const DERBY_SLUG = 'dallas-derby-day-2026';

export const DERBY_BLOCK_IDS = {
  cover: 'd0000000-0000-4000-8000-0000000000c0',
  scopeIntro: 'd0000000-0000-4000-8000-0000000000c1',
  scopeItems: 'd0000000-0000-4000-8000-0000000000c2',
  visualIntro: 'd0000000-0000-4000-8000-0000000000c3',
  moodboard: 'd0000000-0000-4000-8000-0000000000c4',
  showcase: 'd0000000-0000-4000-8000-0000000000c5',
  pricingIntro: 'd0000000-0000-4000-8000-0000000000c6',
  pricing: 'd0000000-0000-4000-8000-0000000000c7',
  phases: 'd0000000-0000-4000-8000-0000000000c8',
  outcomes: 'd0000000-0000-4000-8000-0000000000c9',
  actionItems: 'd0000000-0000-4000-8000-0000000000ca',
  timeline: 'd0000000-0000-4000-8000-0000000000cb',
  signature: 'd0000000-0000-4000-8000-0000000000cc',
  sampleIntro: 'd0000000-0000-4000-8000-0000000000cd',
  gamePlanIntro: 'd0000000-0000-4000-8000-0000000000ce',
  nextStepsIntro: 'd0000000-0000-4000-8000-0000000000cf',
} as const;

const p = (blockId: string, file: string) =>
  `proposals/${DERBY_PROPOSAL_ID}/${blockId}/${file}`;

export const DERBY_THEME: ProposalTheme = {
  accent: 'green',
  agencyName: 'Thrive Creative Studios',
  headerNote: 'April 21, 2026 · Confidential',
};

/** Local files under public/ uploaded into the private proposal-media bucket. */
export const DERBY_UPLOADS: { localPath: string; storagePath: string }[] = [
  {
    localPath: 'public/DallasDerbyDay/cover-photo.png',
    storagePath: p(DERBY_BLOCK_IDS.cover, 'cover-photo.png'),
  },
  {
    localPath: 'public/DallasDerbyDay/April23-LiveMusicGraphic.png',
    storagePath: p(DERBY_BLOCK_IDS.showcase, 'feed-post.png'),
  },
  {
    localPath: 'public/DallasDerbyDay/April24-LoneStarParkRunwayGraphic.png',
    storagePath: p(DERBY_BLOCK_IDS.showcase, 'graphic-card.png'),
  },
  {
    localPath: 'public/DallasDerbyDay/April25-somewhereindallasGraphic.png',
    storagePath: p(DERBY_BLOCK_IDS.showcase, 'story.png'),
  },
];

/**
 * The retainer is a single flat line item, exactly as quoted. The source
 * document prices it as one number — splitting it into per-deliverable
 * amounts would invent prices the client was never given.
 */
export const DERBY_LINE_ITEMS = [
  {
    label: 'Design retainer — Dallas Derby Day campaign',
    description: 'All assets · All formats · 11-day campaign · Up to 3 revisions per asset',
    quantity: 1,
    unit_price_cents: 180000,
    position: 0,
  },
];

export const DERBY_BLOCKS: ProposalBlock[] = [
  {
    id: DERBY_BLOCK_IDS.cover,
    type: 'cover',
    position: 0,
    visible: true,
    // Lime heading over an orange duotone, as the cover is designed.
    accent: 'green',
    content: {
      // The running header already carries the studio name on this page.
      eyebrow: '',
      titleLine1: 'PROJECT',
      titleLine2: 'PROPOSAL',
      subtitle: 'FOR DALLAS DERBY DAY',
      projectName: 'FOR DALLAS DERBY DAY',
      tagline: 'A Brighter Black — Luxury, Leisure & Dandyism',
      dateLabel: 'April 21, 2026',
      preparedFor: 'Shiattin Makor · Dallas Derby Day',
      preparedBy: 'Thrive Creative Studios · Lauren',
      heroImagePath: p(DERBY_BLOCK_IDS.cover, 'cover-photo.png'),
      heroOverlay: 'orange',
      stats: [
        { value: '40', label: 'Existing sign-ups' },
        { value: '310', label: 'Remaining goal' },
        { value: '11', label: 'Days to event' },
        { value: '$200', label: 'Ticket price' },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.scopeIntro,
    type: 'narrative',
    position: 1,
    visible: true,
    accent: 'magenta',
    content: {
      headingLine1: 'SCOPE',
      headingLine2: 'OF WORK',
      kicker: 'WHAT YOU ARE GETTING',
      body: [
        '**Full-service event marketing & promotion — Dallas Derby Day**',
        'Thrive Creative Studios will serve as your dedicated design team for the Dallas Derby Day campaign — April 21 through May 2, 2026. This engagement covers all creative asset production: static graphics, motion graphics, overlays, and email designs. You handle the posting. We handle everything you post.',
        'Assets are delivered in batches so your content is always ready ahead of schedule, and every deliverable includes up to 3 rounds of revisions.',
      ].join('\n\n'),
    },
  },

  {
    id: DERBY_BLOCK_IDS.scopeItems,
    type: 'feature_list',
    position: 2,
    visible: true,
    accent: 'magenta',
    content: {
      kicker: 'EVERYTHING INCLUDED IN THIS ENGAGEMENT',
      items: [
        {
          title: 'Static Social Media Graphics',
          description:
            'Feed posts (1080×1080) and Story graphics (1080×1920) — formatted, branded, and ready to post.',
        },
        {
          title: 'Motion Graphics / Animated Posts',
          description:
            'Animated feed posts and Story animations — countdown reveals, event hype, and announcement content.',
        },
        {
          title: 'Video Overlays & Branded Frames',
          description:
            'Text overlays, lower thirds, and branded frames to enhance any video content you film yourself.',
        },
        {
          title: 'Event Flyer — Print & Digital',
          description:
            'A shareable event flyer formatted for both digital distribution and print if needed.',
        },
        {
          title: 'ALTO Partnership Co-Branded Assets',
          description:
            'Dedicated graphics for the ALTO partnership — feed and story formats with discount code integration.',
        },
        {
          title: 'Email Header & Layout Designs',
          description:
            '3 designed email layouts — launch, mid-campaign, and final blast — ready to drop into any email platform.',
        },
        {
          title: 'Urgency & Countdown Graphics',
          description:
            'Countdown timers, "last call" story graphics, and social proof post templates for the final sprint.',
        },
        {
          title: 'Up to 3 Revisions Per Asset',
          description:
            'Every deliverable revised until it is exactly right — no extra charges within the revision limit.',
        },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.visualIntro,
    type: 'narrative',
    position: 3,
    visible: true,
    accent: 'orange',
    content: {
      headingLine1: 'VISUAL',
      headingLine2: 'DIRECTION',
      kicker: 'MOODBOARD · AESTHETIC REFERENCE · BRAND FEEL',
      body: 'Every caption, every post, every influencer brief is written to evoke this world. This is the visual language of Dallas Derby Day — Black dandyism meets luxury leisure. Polo grounds, garden parties, editorial fashion. Aspirational, warm, and unapologetically Black.',
    },
  },

  {
    id: DERBY_BLOCK_IDS.moodboard,
    type: 'moodboard',
    position: 4,
    visible: true,
    accent: 'orange',
    content: {
      headingLine1: '',
      headingLine2: '',
      caption: 'Black Old Money Spring Aesthetic',
      // These tiles were empty drop-zones in the source deck. They keep their
      // labels so the placeholder reads as an intentional slot, not a break.
      images: [
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-hat.jpg'), alt: 'The Hat — wide-brim, garden party, cream + ivory tones', span: 2 },
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-setting.jpg'), alt: 'The Setting — green lawns, open air, polo ground elegance' },
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-moment.jpg'), alt: 'The Moment — champagne, laughter, Black joy in luxury spaces' },
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-suit.jpg'), alt: 'The Suit — linen, tailored, pressed. White, navy, caramel' },
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-florals.jpg'), alt: 'The Florals — fresh arrangements, pastel accents on dark palette' },
        { path: p(DERBY_BLOCK_IDS.moodboard, 'the-energy.jpg'), alt: 'The Energy — equestrian, sport, grand afternoon tradition', span: 2 },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.sampleIntro,
    type: 'narrative',
    position: 5,
    visible: true,
    accent: 'green',
    content: {
      headingLine1: 'SAMPLE',
      headingLine2: 'GRAPHICS',
      kicker: 'CONTENT FORMATS WE WILL POST',
      body: 'All graphics will be created in the Dallas Derby Day palette above — deep black grounds, champagne gold and ivory type, editorial photography with colour overlays. Here are the three post formats we will use throughout the campaign.',
    },
  },

  {
    id: DERBY_BLOCK_IDS.showcase,
    type: 'showcase',
    position: 5,
    visible: true,
    accent: 'green',
    content: {
      intro: '',
      cards: [
        {
          imagePath: p(DERBY_BLOCK_IDS.showcase, 'feed-post.png'),
          title: 'Feed Post (1:1)',
          subtitle: 'Launch · Aesthetic · Urgency',
        },
        {
          imagePath: p(DERBY_BLOCK_IDS.showcase, 'graphic-card.png'),
          title: 'Graphic Card (1:1)',
          subtitle: 'Text-forward · No photo needed',
        },
        {
          imagePath: p(DERBY_BLOCK_IDS.showcase, 'story.png'),
          title: 'Story (9:16)',
          subtitle: 'Daily · Countdown sticker',
        },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.pricingIntro,
    type: 'narrative',
    position: 6,
    visible: true,
    accent: 'magenta',
    content: {
      headingLine1: 'INVESTMENT &',
      headingLine2: 'PRICING',
      kicker: 'THRIVE CREATIVE STUDIOS — DESIGN RETAINER',
      body: 'This is a flat-rate design retainer covering all creative asset production for the Dallas Derby Day campaign — April 21 through May 2, 2026. No per-asset billing, no hourly tracking. One flat investment for everything you need, delivered in batches as the campaign runs. Each asset includes up to 3 rounds of revisions so you always get exactly what you need without scope creep on either side.',
    },
  },

  {
    id: DERBY_BLOCK_IDS.pricing,
    type: 'pricing',
    position: 7,
    visible: true,
    accent: 'magenta',
    content: {
      kicker: "WHAT'S COVERED UNDER THE RETAINER",
      intro: '',
      showLineItemPrices: false,
      totalLabel: 'TOTAL RETAINER',
      deliverables: [
        {
          title: 'Static Social Graphics',
          description:
            'Feed posts, story graphics, and shareable flyers — as many as needed for the campaign.',
        },
        {
          title: 'Motion Graphics',
          description:
            'Animated posts and story animations — event countdowns, reveals, and hype content.',
        },
        {
          title: 'Video Overlays',
          description:
            'Text overlays, lower thirds, and branded frames for any video content you produce.',
        },
        {
          title: 'Email Designs',
          description:
            'Designed headers and layout for all 3 campaign emails — launch, mid-campaign, final blast.',
        },
        {
          title: 'ALTO Partnership Assets',
          description:
            'Co-branded graphics for the ALTO partnership — feed and story formats.',
        },
        {
          title: 'Brand Consistency',
          description:
            'All assets built to the same visual system — colours, fonts, and aesthetic locked in from Day 1.',
        },
      ],
      footnote:
        '**Revision policy.** Each deliverable includes up to 3 rounds of revisions at no additional charge. Revisions beyond 3 rounds are billed at $75/hour. Revision requests must be submitted within 24 hours of delivery to keep the campaign on schedule.',
    },
  },

  {
    id: DERBY_BLOCK_IDS.gamePlanIntro,
    type: 'narrative',
    position: 9,
    visible: true,
    accent: 'orange',
    content: {
      headingLine1: 'GAME PLAN',
      headingLine2: '& OUTCOMES',
      kicker: '',
      body: '',
    },
  },

  {
    id: DERBY_BLOCK_IDS.phases,
    type: 'phases',
    position: 8,
    visible: true,
    accent: 'orange',
    content: {
      phases: [
        {
          label: 'Phase 1',
          name: 'Launch',
          description:
            'All platforms activated simultaneously. Influencer network deployed. Email list engaged. Every channel live from day one.',
        },
        {
          label: 'Phase 2',
          name: 'Build',
          description:
            'Aesthetic content builds the visual world of the event. Lifestyle, fashion, and mood imagery draws in the right audience.',
        },
        {
          label: 'Phase 3',
          name: 'Social Proof',
          description:
            'Momentum is shown publicly. ALTO partnership featured. Community energy amplified through reposts and engagement.',
        },
        {
          label: 'Phase 4',
          name: 'Second Wave',
          description:
            'Influencers re-engage with fresh copy. Urgency language introduced. The audience feels the event filling up.',
        },
        {
          label: 'Phase 5',
          name: 'Referral',
          description:
            'Existing sign-ups become advocates. Incentive-driven sharing expands reach organically beyond the original audience.',
        },
        {
          label: 'Phase 6',
          name: 'Amplify',
          description:
            'All content is cross-posted and amplified. Community groups, orgs, and professional networks receive targeted outreach.',
        },
        {
          label: 'Phase 7',
          name: 'Final Push',
          description:
            'Countdown content drives urgency. Last influencer ask. Email list receives final call before the event window closes.',
        },
        {
          label: 'Phase 8',
          name: 'Closing Sprint',
          description:
            'Maximum frequency posting. Real-time social proof. Last-chance messaging creates the final purchase trigger.',
        },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.outcomes,
    type: 'split_narrative',
    position: 9,
    visible: true,
    accent: 'purple',
    content: {
      left: {
        heading: 'Projected Outcomes',
        body: [
          '**Sold-out energy.** A fully executed multi-channel campaign creates the perception of a sold-out event — which drives real urgency and real purchases.',
          '**Brand elevation.** Every graphic asset reinforces Dallas Derby Day as a premium, luxury experience. The visual identity does the selling.',
          '**Influencer reach.** Your influencer network extends the campaign far beyond your own following — into warm, pre-qualified audiences who trust the recommendation.',
          '**ALTO partnership impact.** The ALTO co-promotion adds a luxury layer to the experience and unlocks a second audience through their own social channels.',
          '**Referral momentum.** Early sign-ups become advocates. Word-of-mouth multiplies the campaign reach with zero additional cost.',
        ].join('\n\n'),
      },
      right: {
        heading: 'Ticket Pricing Strategy',
        body: [
          '**Full price.** Launch pricing — maximise early revenue.',
          '**Flash promo.** Mid-campaign boost — limited time offer.',
          '**Urgency promo.** Final push — last-resort conversion tool.',
          'Start at $200 regular pricing and do not discount before the campaign has run. If sign-up velocity falls behind pace by Day 4, deploy a 48-hour flash promo at $150 with urgency language. Reserve the $100 promo only as a last-resort tool in the final 72 hours.',
        ].join('\n\n'),
      },
    },
  },

  {
    id: DERBY_BLOCK_IDS.nextStepsIntro,
    type: 'narrative',
    position: 12,
    visible: true,
    accent: 'green',
    content: {
      headingLine1: 'NEXT',
      headingLine2: 'STEPS',
      kicker: '',
      body: '',
    },
  },

  {
    id: DERBY_BLOCK_IDS.actionItems,
    type: 'action_items',
    position: 10,
    visible: true,
    accent: 'green',
    content: {
      kicker: 'ACTION ITEMS',
      items: [
        {
          title: 'Approve this proposal',
          description: 'Sign or reply with written approval to begin the engagement.',
        },
        {
          title: 'Submit 50% deposit via client portal',
          description: 'Pay securely through the Thrive Creative Studios client portal.',
        },
        {
          title: 'Share the registration / ticket link',
          description: 'Needed for all graphics, captions, and influencer briefs.',
        },
        {
          title: 'Share your influencer contact list',
          description: 'Handles and preferred contact method for each influencer.',
        },
        {
          title: 'Confirm event social media handles',
          description: 'Instagram, Facebook, Twitter/X — for tags across all assets.',
        },
      ],
      closing:
        'The event is May 2nd. Work begins April 22nd. Track everything in your client portal.',
    },
  },

  {
    id: DERBY_BLOCK_IDS.timeline,
    type: 'delivery_timeline',
    position: 11,
    visible: true,
    accent: 'orange',
    content: {
      kicker: 'WHAT HAPPENS AFTER APPROVAL',
      milestones: [
        {
          label: 'April 22 — Day 1',
          description:
            'Production begins. Visual direction locked, brand colours set, templates built. Progress visible in your client portal.',
        },
        {
          label: 'Within 48 hours',
          description:
            'First asset delivery — launch graphics, story templates, and email header design handed off and ready to post.',
        },
        {
          label: 'Mid-campaign',
          description:
            'Second batch delivered — motion graphics, overlays, and urgency content ready ahead of the closing sprint.',
        },
        {
          label: 'Final delivery',
          description:
            'Closing sprint assets and all remaining revisions completed before the event window closes on May 2nd.',
        },
        {
          label: 'Throughout',
          description:
            'All progress, file deliveries, and revision requests tracked in the Thrive Creative Studios client portal.',
        },
      ],
    },
  },

  {
    id: DERBY_BLOCK_IDS.signature,
    type: 'signature',
    position: 12,
    visible: true,
    accent: 'green',
    content: {
      agencySignerName: 'Lauren',
      agencySignerTitle: 'Founder & Creative Director',
      clientSignerLabel: 'Client approval — Shiattin Makor',
    },
  },
];
