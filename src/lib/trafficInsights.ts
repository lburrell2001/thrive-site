// "What can I do to get more traffic?" — rules over the analytics report.
//
// Each rule looks for one pattern, names the numbers behind it, and says
// what to do in terms that fit a Dallas creative studio. Rules that need
// volume stay quiet until there is enough data for the pattern to mean
// something; a handful of visits proves nothing.

import type { AnalyticsReport, Insight, PageRow } from '@/types/analytics';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

const SERVICE_PAGE = /^\/services\/.+/;

export function buildInsights(r: Omit<AnalyticsReport, 'insights'>): Insight[] {
  const out: Insight[] = [];
  const t = r.totals;
  const visits = t.visits;

  if (visits === 0) {
    return [{
      id: 'no-data',
      tone: 'info',
      priority: 100,
      title: r.trackingSince ? 'No visits in this period' : 'Tracking has just started',
      evidence: r.trackingSince
        ? `The first visit was recorded ${new Date(r.trackingSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Try a longer range.`
        : 'Visits are counted from the moment this update went live. Your own visits from this browser are not counted.',
      actions: ['Share a tagged link (link builder below) in your Instagram bio so the first visits have a source.'],
    }];
  }

  const channelShare = (c: string) => (r.channels.find((x) => x.channel === c)?.visits ?? 0) / visits;
  const enough = visits >= 30;

  if (!enough) {
    out.push({
      id: 'early',
      tone: 'info',
      priority: 5,
      title: 'Early days — suggestions sharpen with more visits',
      evidence: `${plural(visits, 'visit')} so far in this period. Most patterns below need about 30 to be meaningful.`,
      actions: [],
    });
  }

  // ------------------------------------------------------------ trend
  if (r.previous.visits >= 20) {
    const change = (visits - r.previous.visits) / r.previous.visits;
    if (change >= 0.2) {
      out.push({
        id: 'trend-up', tone: 'win', priority: 40,
        title: `Traffic is up ${pct(change)} on the previous ${r.days} days`,
        evidence: `${visits} visits vs ${r.previous.visits}.`,
        actions: ['Check the sources table for what grew, and do more of it while it is working.'],
      });
    } else if (change <= -0.2) {
      out.push({
        id: 'trend-down', tone: 'warning', priority: 70,
        title: `Traffic is down ${pct(-change)} on the previous ${r.days} days`,
        evidence: `${visits} visits vs ${r.previous.visits}.`,
        actions: [
          'Compare the sources table with last period — a quieter posting stretch on Instagram or LinkedIn usually shows up here first.',
          'Re-share a recent case study with a tagged link to restart the flow.',
        ],
      });
    }
  }

  // ----------------------------------------------------------- search
  const searchShare = channelShare('search');
  if (enough && searchShare < 0.25) {
    out.push({
      id: 'search-low', tone: 'opportunity', priority: 90,
      title: searchShare === 0 ? 'Nobody is finding you on Google yet' : `Only ${pct(searchShare)} of visits come from search`,
      evidence: `${Math.round(searchShare * visits)} of ${visits} visits arrived from a search engine. Search is the one source that keeps sending people without you posting.`,
      actions: [
        'Set up or complete your Google Business Profile as a Dallas design studio, with photos of your work, and link it with the "Google Business Profile" preset below.',
        'Add the site to Google Search Console and submit /sitemap.xml so every project page gets indexed.',
        'Give each case study a title and first paragraph that say what and where — e.g. "Brand identity for a Dallas wellness studio" — since that is what people type.',
        'Get listed where clients compare studios (Clutch, Behance, Dribbble, local Dallas business directories), each linking back to the site.',
      ],
    });
  }

  // -------------------------------------------------------- untagged
  const directShare = channelShare('direct');
  if (enough && directShare > 0.4) {
    out.push({
      id: 'direct-high', tone: 'opportunity', priority: 60,
      title: `${pct(directShare)} of visits have no known source`,
      evidence: 'Instagram\'s in-app browser, link-in-bio tools, texts and PDFs usually hide where a visit came from, so it lands here.',
      actions: [
        'Use the link builder below for your Instagram bio, story links, LinkedIn posts and email signature — each gets its own line in the sources table.',
      ],
    });
  } else if (r.campaigns.length === 0 && visits >= 10) {
    out.push({
      id: 'no-campaigns', tone: 'info', priority: 15,
      title: 'None of your links are tagged yet',
      evidence: 'Tagged links show exactly which post, bio link or email brought someone in.',
      actions: ['Start with your Instagram bio link using the link builder below.'],
    });
  }

  // ------------------------------------------------------------ social
  const social = r.sources.filter((s) => s.channel === 'social');
  const topSocial = social[0];
  if (topSocial && topSocial.visits >= 10 && topSocial.inquiries === 0) {
    out.push({
      id: `social-no-leads-${topSocial.source}`, tone: 'opportunity', priority: 65,
      title: `${topSocial.source} sends visits but no inquiries`,
      evidence: `${plural(topSocial.visits, 'visit')} from ${topSocial.source}, ${pct(topSocial.bounceRate)} of them left after one page, and none wrote in.`,
      actions: [
        'Point links at the page the post is about — the matching case study or service page — not the homepage.',
        'End posts with one clear ask ("Booking brand projects for spring — link in bio") and make that link go straight to /contact.',
      ],
    });
  } else if (enough && channelShare('social') < 0.1) {
    out.push({
      id: 'social-low', tone: 'opportunity', priority: 45,
      title: 'Social media is barely sending traffic',
      evidence: `${pct(channelShare('social'))} of visits came from social platforms.`,
      actions: [
        'Post finished projects as carousels and link each to its case study with a story link sticker.',
        'Share case studies on LinkedIn as well — business owners who hire studios spend time there.',
      ],
    });
  }

  // ---------------------------------------------------- what converts
  const converting = r.sources.filter((s) => s.visits >= 5 && s.inquiries >= 2);
  const best = converting.toSorted((a, b) => b.inquiries / b.visits - a.inquiries / a.visits)[0];
  if (best) {
    out.push({
      id: `best-${best.source}`, tone: 'win', priority: 50,
      title: `${best.source} brings your best leads`,
      evidence: `${pct(best.inquiries / best.visits)} of visits from ${best.source} became inquiries (${best.inquiries} of ${best.visits}), against ${pct(t.conversionRate)} overall.`,
      actions: [`Put more time into ${best.source} — it pays back better than anything else right now.`],
    });
  }
  const topRevenue = r.sources.filter((s) => s.wonValueCents > 0).toSorted((a, b) => b.wonValueCents - a.wonValueCents)[0];
  if (topRevenue) {
    out.push({
      id: `revenue-${topRevenue.source}`, tone: 'win', priority: 55,
      title: `${topRevenue.source} has brought ${money(topRevenue.wonValueCents)} in won work`,
      evidence: `${plural(topRevenue.won, 'client')} who wrote in after arriving from ${topRevenue.source} this period ${topRevenue.won === 1 ? 'is' : 'are'} now marked Won in the CRM.`,
      actions: ['Ask those clients for a testimonial or referral while the project is fresh.'],
    });
  }

  // ----------------------------------------------------- page problems
  const leaky = r.pages
    .filter((p): p is PageRow & { bounceRate: number } => p.landings >= 10 && (p.bounceRate ?? 0) >= 0.7)
    .toSorted((a, b) => b.landings - a.landings)
    .slice(0, 2);
  for (const p of leaky) {
    out.push({
      id: `bounce-${p.path}`, tone: 'warning', priority: 58,
      title: `Most people leave ${p.path} right away`,
      evidence: `${pct(p.bounceRate)} of the ${p.landings} visits that started on this page left within 10 seconds without clicking further.`,
      actions: [
        'Make the first screen say what you do, who it is for, and give one button to click.',
        'Link to two or three related projects so there is somewhere obvious to go next.',
        'Check it on a phone over cellular — a heavy hero video or image can make people give up before it loads.',
      ],
    });
  }

  const quietServices = r.pages
    .filter((p) => SERVICE_PAGE.test(p.path) && p.views >= 15 && p.inquiries === 0)
    .slice(0, 2);
  for (const p of quietServices) {
    out.push({
      id: `service-${p.path}`, tone: 'opportunity', priority: 52,
      title: `${p.path} gets read but doesn't lead to inquiries`,
      evidence: `${plural(p.views, 'view')}, average ${Math.round(p.avgEngagedSec)}s on page, no inquiries from those visits.`,
      actions: [
        'Add a "Start a project" button at the end and part way down.',
        'Show a starting price or package and a short process — people hesitate to ask when they cannot tell if they can afford it.',
        'Add a client quote specific to this service.',
      ],
    });
  }

  const contact = r.pages.find((p) => p.path === '/contact');
  if (contact && contact.views >= 10 && contact.inquiries / contact.views < 0.15) {
    out.push({
      id: 'contact-drop', tone: 'warning', priority: 68,
      title: 'People open the contact page but don\'t send the form',
      evidence: `${plural(contact.views, 'view')} of /contact, ${plural(contact.inquiries, 'inquiry')} sent from those visits (${pct(contact.inquiries / contact.views)}).`,
      actions: [
        'Make only name, email and message required — budget and timeline can be optional.',
        'Offer a lighter option next to the form: a "book a 15-minute call" link or your email address.',
      ],
    });
  }

  // ------------------------------------------------------------ mobile
  const mobile = r.devices.find((d) => d.label === 'mobile');
  const desktop = r.devices.find((d) => d.label === 'desktop');
  if (mobile && desktop && mobile.visits >= 10 && desktop.visits >= 10 && mobile.bounceRate - desktop.bounceRate >= 0.15) {
    out.push({
      id: 'mobile-bounce', tone: 'warning', priority: 62,
      title: 'Phone visitors leave much faster than desktop ones',
      evidence: `${pct(mobile.bounceRate)} of phone visits bounce vs ${pct(desktop.bounceRate)} on desktop, and ${pct(mobile.visits / visits)} of your traffic is on a phone.`,
      actions: [
        'Load the homepage on your phone over cellular and time it; compress or shorten the hero video if it lags.',
        'Check buttons are easy to tap and the menu opens cleanly on a small screen.',
      ],
    });
  }

  // ------------------------------------------------------- hidden work
  if (visits >= 50 && r.unseenPages.length >= 3) {
    out.push({
      id: 'unseen', tone: 'opportunity', priority: 35,
      title: `${plural(r.unseenPages.length, 'page')} on your site got no visits`,
      evidence: `Including ${r.unseenPages.slice(0, 3).join(', ')}.`,
      actions: [
        'Link these from the related service pages and from other case studies.',
        'Share one of them this week with a tagged link.',
      ],
    });
  }

  // -------------------------------------------------------------- paid
  const paid = r.channels.find((c) => c.channel === 'paid');
  if (paid && paid.visits >= 10 && paid.inquiries === 0) {
    out.push({
      id: 'paid-no-leads', tone: 'warning', priority: 75,
      title: 'Ad clicks are not turning into inquiries',
      evidence: `${plural(paid.visits, 'visit')} from paid ads, no inquiries.`,
      actions: [
        'Send ads to the service page that matches the ad, not the homepage.',
        'Tighten the ad keywords to buying searches ("branding agency Dallas") and add negatives for jobs and free templates.',
      ],
    });
  }

  // ---------------------------------------------------------------- AI
  const ai = r.channels.find((c) => c.channel === 'ai');
  if (ai && ai.visits > 0) {
    out.push({
      id: 'ai', tone: 'win', priority: 20,
      title: `AI assistants sent ${plural(ai.visits, 'visit')}`,
      evidence: `People asking ${r.sources.filter((s) => s.channel === 'ai').map((s) => s.source).join(', ')} for a studio were pointed to you.`,
      actions: ['Keep service pages plain about what you offer, where, and for whom — that is what these tools quote.'],
    });
  }

  // ------------------------------------------------------- conversion
  if (visits >= 100 && t.conversionRate < 0.01) {
    out.push({
      id: 'conversion-low', tone: 'opportunity', priority: 48,
      title: 'Fewer than 1 in 100 visits becomes an inquiry',
      evidence: `${plural(t.inquiries, 'inquiry')} from ${visits} visits.`,
      actions: [
        'Put a "Work with me" button in the header and at the end of every case study.',
        'Offer something useful for people not ready to hire — a brand checklist in exchange for an email.',
      ],
    });
  }

  if (enough && t.avgEngagedSec > 0 && t.avgEngagedSec < 20) {
    out.push({
      id: 'engagement-low', tone: 'warning', priority: 42,
      title: 'Visits are short',
      evidence: `The average visit spends ${Math.round(t.avgEngagedSec)} seconds with a page in view.`,
      actions: ['Lead with your strongest project on the homepage, and make the next click obvious.'],
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 8);
}
