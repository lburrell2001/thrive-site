// The portal's tours and tips (PortalHelp.tsx). The main tour walks the
// sidebar; each page has its own short tour of what's on it, offered the
// first time a client opens that page, and a few tips that sit at the top of
// the ? menu while they're on it.
//
// A step's target is found on the page as it is: a CSS selector, a heading's
// exact text, or a button/link whose text starts with something — then `up`
// levels to its card. If it isn't on screen (no invoices yet, say), the step
// shows as a centred card instead.

export type TourTarget = { sel?: string; text?: string; button?: string; up?: number };
export type TourStep = { target: TourTarget | null; title: string; body: string; nav?: boolean };

const nav = (href: string): TourTarget => ({ sel: `[data-tour="${href}"]` });

export const MAIN_TOUR: TourStep[] = [
  { target: null, title: 'Welcome to your portal', body: 'A one-minute look around, so you know where everything lives. You can leave any time.' },
  { target: nav('/portal/dashboard'), nav: true, title: 'Dashboard', body: 'What’s happening right now: your projects, invoices due, milestones coming up and what we’ve been working on.' },
  { target: nav('/portal/onboarding'), nav: true, title: 'Onboarding', body: 'Questionnaires and first steps for your project. Your answers save as you go, so you can come back to them.' },
  { target: nav('/portal/progress'), nav: true, title: 'My Projects', body: 'Each project’s progress, files, milestones and requests. Completion reports land here when a project wraps up.' },
  { target: nav('/portal/proposals'), nav: true, title: 'Proposals', body: 'Read your proposals and sign them here. Signing sets up your invoice straight away.' },
  { target: nav('/portal/vault'), nav: true, title: 'Secure Vault', body: 'Share website, hosting or social logins safely, instead of texting or emailing passwords.' },
  { target: nav('/portal/invoices'), nav: true, title: 'Billing', body: 'Your invoices: accept or decline them, download PDFs and pay by card.' },
  { target: nav('/portal/settings'), nav: true, title: 'Settings', body: 'Your name, business and phone, and whether you’d like text updates.' },
  { target: { sel: '[data-tour="help"]' }, title: 'Help is always here', body: 'Tap ? any time for tips on the page you’re on, to take a tour again, or to tell us if something isn’t working. It comes straight to Lauren.' },
];

export type PageGuide = { name: string; tour: TourStep[]; tips: string[] };

export const PAGE_GUIDES: Record<string, PageGuide> = {
  '/portal/dashboard': {
    name: 'your dashboard',
    tips: ['Your numbers at the top update as work moves along.', 'Quick Actions jump straight to the things people do most.', 'Milestones show the dates coming up on your projects.'],
    tour: [
      { target: { sel: '.dash-stats' }, title: 'Your numbers', body: 'Active projects, open brain dumps, what’s due and files delivered, at a glance.' },
      { target: { sel: '.dash-projects' }, title: 'Active projects', body: 'Each project’s progress. “+ New Brain Dump” sends us an idea or request any time, big or small.' },
      { target: { sel: '.dash-activity' }, title: 'Recent activity', body: 'Everything that’s happened lately: files delivered, invoices sent, milestones done.' },
      { target: { text: 'Quick Actions', up: 1 }, title: 'Quick actions', body: 'Shortcuts to a brain dump, uploading files, paying, your proposal and the vault.' },
      { target: { text: 'Upcoming Milestones', up: 1 }, title: 'Upcoming milestones', body: 'The dates coming up on your projects, so nothing sneaks up on you.' },
    ],
  },
  '/portal/invoices': {
    name: 'Billing',
    tips: ['Accept an invoice to say it looks right, or Decline it and tell us what’s off.', 'Pay by card with the Pay button; your receipt comes by email.', 'PDF downloads a copy for your records.'],
    tour: [
      { target: { sel: '.inv-stats' }, title: 'Your totals', body: 'What you’ve paid, what’s outstanding or overdue, and when the next payment is due.' },
      { target: { text: 'Invoices & Payments', up: 2 }, title: 'Every invoice', body: 'Filter by due, overdue or paid. Each one has a PDF you can download.' },
      { target: { button: 'Accept' }, title: 'Accept or decline', body: 'Accept when an invoice looks right. If something’s off, Decline and tell us why, and we’ll sort it out.' },
      { target: { button: 'Pay' }, title: 'Pay by card', body: 'Pays securely through Stripe. With a deposit, only the part that’s due now is charged.' },
    ],
  },
  '/portal/progress': {
    name: 'My Projects',
    tips: ['Tap a project to open its invoices, files, milestones and requests.', 'Completion reports appear on a project when it wraps up.', 'Finished projects move to Archived Projects at the bottom.'],
    tour: [
      { target: null, title: 'Your projects', body: 'Each project shows its progress bar. Tap one to open its invoices, files, milestones and requests.' },
      { target: null, title: 'Need something?', body: 'Inside a project, “+ New” sends us a request about that project.' },
      { target: { button: 'Archived Projects' }, title: 'Finished work', body: 'Completed projects live here, with their completion reports to download.' },
    ],
  },
  '/portal/onboarding': {
    name: 'Onboarding',
    tips: ['Answers save as you type, so you can stop and come back.', 'Submit a questionnaire when it’s done; we’ll reopen it if anything needs changing.'],
    tour: [
      { target: { sel: '#qs-title', up: 1 }, title: 'Your questionnaires', body: 'A few questions about you and your project. Answers save as you go.' },
      { target: { text: 'Need Help With Onboarding?', up: 1 }, title: 'Stuck?', body: 'Reach us from here, or tap ? in the corner any time.' },
    ],
  },
  '/portal/proposals': {
    name: 'Proposals',
    tips: ['“Review & sign” opens your proposal; signing sets up your invoice straight away.', 'For a PDF proposal, download it, sign it and upload the signed copy here.'],
    tour: [
      { target: { button: 'Review & sign' }, title: 'Review and sign', body: 'Opens your proposal with its estimate. Approve and sign at the bottom, or tell us if you’re not going ahead.' },
      { target: null, title: 'PDF proposals', body: 'If we sent a PDF, download it, sign it, then upload the signed copy here.' },
    ],
  },
  '/portal/vault': {
    name: 'the Secure Vault',
    tips: ['Passwords are encrypted before they’re saved.', 'You can see when Thrive last viewed each login.', 'Edit or remove a login any time.'],
    tour: [
      { target: { button: '+ Add Credential' }, title: 'Add a login', body: 'Website host, domain, CMS or social: the name, username and password. Passwords are encrypted before they’re saved.' },
      { target: null, title: 'Always in your control', body: 'Each login shows when Thrive last viewed it. Edit or remove one whenever you like.' },
    ],
  },
  '/portal/settings': {
    name: 'Settings',
    tips: ['Keep your phone number current for text updates.', 'Text updates are optional; reply STOP to any text to turn them off.'],
    tour: [
      { target: { text: 'Profile', up: 1 }, title: 'Your details', body: 'Your name, business and mobile number.' },
      { target: null, title: 'Text updates', body: 'Turn on texts for new invoices and updates. Reply STOP to any text to turn them off.' },
    ],
  },
  '/portal/requests': {
    name: 'Brain Dump',
    tips: ['Send ideas, requests or questions, half-formed is fine.', 'Each one shows where it stands: Kickoff, In Progress, Review, Completed.'],
    tour: [
      { target: { text: 'New Brain Dump', up: 1 }, title: 'Tell us anything', body: 'Ideas, requests or questions, big or small and half-formed is fine. Pick a project or start a new one.' },
      { target: null, title: 'Track it', body: 'Each brain dump shows where it stands, from Kickoff to Completed.' },
    ],
  },
};

/** The element a step points at, if it's on screen. */
export function findTarget(t: TourTarget | null): HTMLElement | null {
  if (!t) return null;
  let el: HTMLElement | null = null;
  if (t.sel) el = document.querySelector<HTMLElement>(t.sel);
  else if (t.text) el = [...document.querySelectorAll<HTMLElement>('main h1, main h2, main h3, main div, main span')].find((e) => e.children.length === 0 && e.textContent?.trim() === t.text) ?? null;
  else if (t.button) el = [...document.querySelectorAll<HTMLElement>('main button, main a, main label')].find((e) => e.textContent?.trim().startsWith(t.button!)) ?? null;
  for (let i = 0; el && i < (t.up ?? 0); i++) el = el.parentElement;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}
