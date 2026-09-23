// Where a visit came from, from its referrer and campaign tags.
//
// Used by /api/track for every landing and by /api/contact for an
// inquiry's first-ever visit, so both are classified the same way.

export type Channel = 'search' | 'social' | 'ai' | 'referral' | 'email' | 'paid' | 'direct';

export const CHANNEL_LABEL: Record<Channel, string> = {
  search: 'Search',
  social: 'Social',
  ai: 'AI assistants',
  referral: 'Other sites',
  email: 'Email',
  paid: 'Paid ads',
  direct: 'Direct / untagged',
};

export interface VisitOrigin {
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  click_id?: string | null;
}

export interface Classified {
  source: string;
  channel: Channel;
  referrer_host: string | null;
}

// Host fragment → display name, per channel. First match wins, so the
// google.com subdomains that are not search (Gemini, Gmail) come first.
const KNOWN: { match: RegExp; name: string; channel: Channel }[] = [
  { match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, name: 'ChatGPT', channel: 'ai' },
  { match: /(^|\.)perplexity\.ai$/, name: 'Perplexity', channel: 'ai' },
  { match: /(^|\.)claude\.ai$/, name: 'Claude', channel: 'ai' },
  { match: /(^|\.)gemini\.google\.com$/, name: 'Gemini', channel: 'ai' },
  { match: /(^|\.)copilot\.microsoft\.com$/, name: 'Copilot', channel: 'ai' },
  { match: /(^|\.)mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|(^|\.)mail\.yahoo\.com$/, name: 'Email', channel: 'email' },
  { match: /(^|\.)google\./, name: 'Google', channel: 'search' },
  { match: /(^|\.)bing\.com$/, name: 'Bing', channel: 'search' },
  { match: /(^|\.)duckduckgo\.com$/, name: 'DuckDuckGo', channel: 'search' },
  { match: /(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, name: 'Yahoo', channel: 'search' },
  { match: /(^|\.)ecosia\.org$/, name: 'Ecosia', channel: 'search' },
  { match: /(^|\.)search\.brave\.com$/, name: 'Brave Search', channel: 'search' },
  { match: /(^|\.)instagram\.com$|^l\.instagram\.com$/, name: 'Instagram', channel: 'social' },
  { match: /(^|\.)facebook\.com$|^(l|lm|m)\.facebook\.com$|(^|\.)fb\.me$/, name: 'Facebook', channel: 'social' },
  { match: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, name: 'LinkedIn', channel: 'social' },
  { match: /(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, name: 'X', channel: 'social' },
  { match: /(^|\.)threads\.(net|com)$/, name: 'Threads', channel: 'social' },
  { match: /(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/, name: 'Pinterest', channel: 'social' },
  { match: /(^|\.)tiktok\.com$/, name: 'TikTok', channel: 'social' },
  { match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, name: 'YouTube', channel: 'social' },
  { match: /(^|\.)reddit\.com$/, name: 'Reddit', channel: 'social' },
  { match: /(^|\.)behance\.net$/, name: 'Behance', channel: 'social' },
  { match: /(^|\.)dribbble\.com$/, name: 'Dribbble', channel: 'social' },
  { match: /(^|\.)linktr\.ee$/, name: 'Linktree', channel: 'social' },
];

// utm_source values people actually type, → the same names as above.
const UTM_NAMES: Record<string, string> = {
  ig: 'Instagram', instagram: 'Instagram',
  fb: 'Facebook', facebook: 'Facebook', meta: 'Facebook',
  linkedin: 'LinkedIn', li: 'LinkedIn',
  twitter: 'X', x: 'X',
  threads: 'Threads', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube',
  google: 'Google', gbp: 'Google Business Profile', bing: 'Bing',
  newsletter: 'Newsletter', email: 'Email', chatgpt: 'ChatGPT', perplexity: 'Perplexity',
};

// Tagged sources with no referrer host of their own.
const UTM_CHANNEL: Record<string, Channel> = {
  'Google Business Profile': 'search',
  Newsletter: 'email',
  Email: 'email',
};

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function titleCase(s: string) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function classifyVisit(origin: VisitOrigin, ownHost?: string | null): Classified {
  let referrer_host = hostOf(origin.referrer);
  // A referrer from our own site is not a source.
  if (referrer_host && ownHost && referrer_host === ownHost.replace(/^www\./, '')) referrer_host = null;

  const utmSource = origin.utm_source?.trim().toLowerCase() || null;
  const utmMedium = origin.utm_medium?.trim().toLowerCase() || null;
  const known = referrer_host ? KNOWN.find((k) => k.match.test(referrer_host!)) : undefined;

  const source =
    (utmSource && (UTM_NAMES[utmSource] ?? titleCase(utmSource))) ||
    known?.name ||
    referrer_host ||
    'Direct';

  let channel: Channel;
  if (origin.click_id || (utmMedium && /^(cpc|ppc|paid|paidsocial|paid_social|display|ads?)$/.test(utmMedium))) {
    channel = 'paid';
  } else if (utmMedium && /e-?mail|newsletter/.test(utmMedium)) {
    channel = 'email';
  } else if (utmMedium && /social|bio|story|stories|post|reel/.test(utmMedium)) {
    channel = 'social';
  } else if (utmMedium && /organic|local|seo/.test(utmMedium)) {
    channel = 'search';
  } else if (known) {
    channel = known.channel;
  } else if (utmSource) {
    const named = KNOWN.find((k) => k.name === source);
    channel = named?.channel ?? UTM_CHANNEL[source] ?? 'referral';
  } else if (referrer_host) {
    channel = 'referral';
  } else {
    channel = 'direct';
  }

  return { source, channel, referrer_host };
}

export function deviceOf(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|vercel-screenshot/i;
