// Subcontract work (migration 076): the protocol for jobs where Thrive works
// under another company (the "prime") for that company's client. Pure — the
// admin page, the deal panel and the server share it. The written version is
// the "Subcontracting Protocol" doc; keep the two in step.

export type StepKey =
  | 'fit_check' | 'estimate_accepted' | 'agreement' | 'w9' | 'deposit_paid' | 'setup' | 'vault'
  | 'milestones' | 'drafts_approved' | 'balance_paid' | 'handoff' | 'report_sent' | 'portfolio_review' | 'closed';

export interface StepDef {
  key: StepKey;
  label: string;
  /** Read from the system when true (can still be ticked by hand). */
  auto: boolean;
  help: string;
  phase: 'Before work' | 'Set up' | 'The work' | 'Wrap-up';
}

export const STEPS: StepDef[] = [
  { key: 'fit_check', phase: 'Before work', auto: false, label: 'Fit-check call done, no red flags', help: 'Ask the eight fit-check questions (Protocol tab) before quoting.' },
  { key: 'estimate_accepted', phase: 'Before work', auto: true, label: 'Estimate sent to the prime and accepted', help: 'Ticks itself when an estimate on this deal is accepted.' },
  { key: 'agreement', phase: 'Before work', auto: false, label: 'Subcontractor agreement signed', help: 'Master agreement with this prime + this job’s estimate as the scope.' },
  { key: 'w9', phase: 'Before work', auto: false, label: 'W-9 sent (and COI, if asked)', help: 'They need it to send you a 1099.' },
  { key: 'deposit_paid', phase: 'Before work', auto: true, label: 'Deposit paid', help: 'Ticks itself when the deposit (or the whole invoice) on this deal is paid. No work before this.' },
  { key: 'setup', phase: 'Set up', auto: true, label: 'Portal project, questionnaires and file request set up', help: 'Ticks itself when the deal has a portal project with a questionnaire or file request filed under it.' },
  { key: 'vault', phase: 'Set up', auto: true, label: 'Logins in the Secure Vault', help: 'Ticks itself once the prime has saved a login in their vault. Not needed? Tick it.' },
  { key: 'milestones', phase: 'Set up', auto: true, label: 'Milestones added', help: 'Ticks itself when the project has a milestone.' },
  { key: 'drafts_approved', phase: 'The work', auto: false, label: 'Drafts approved in writing', help: 'By the prime’s one approver: a Like on the draft, or an email.' },
  { key: 'balance_paid', phase: 'The work', auto: true, label: 'Balance paid, finals unlocked', help: 'Ticks itself when every invoice on this deal is paid.' },
  { key: 'handoff', phase: 'Wrap-up', auto: false, label: 'Handoff sent, your access removed', help: 'Source + exported files, fonts and licences, a one-page how-to. Logins in their name, passwords changed.' },
  { key: 'report_sent', phase: 'Wrap-up', auto: true, label: 'Completion report sent', help: 'Ticks itself when a report is sent from Work in progress.' },
  { key: 'portfolio_review', phase: 'Wrap-up', auto: false, label: 'Portfolio (if allowed) and review asked', help: 'Ask the prime, not the end client, for the review.' },
  { key: 'closed', phase: 'Wrap-up', auto: true, label: 'Deal closed', help: 'Ticks itself when the deal is closed (Close — work is finished).' },
];

export const PHASES = ['Before work', 'Set up', 'The work', 'Wrap-up'] as const;

export type ManualTicks = Partial<Record<StepKey, string>>;
export type AutoState = Partial<Record<StepKey, boolean>>;

export interface StepState { key: StepKey; done: boolean; by: 'auto' | 'hand' | null; at: string | null }

export function stepStates(manual: ManualTicks, auto: AutoState): StepState[] {
  return STEPS.map((s) => {
    if (manual[s.key]) return { key: s.key, done: true, by: 'hand', at: manual[s.key]! };
    if (s.auto && auto[s.key]) return { key: s.key, done: true, by: 'auto', at: null };
    return { key: s.key, done: false, by: null, at: null };
  });
}

/** The first step not done, in order: what to do next. */
export function nextStep(states: StepState[]): StepDef | null {
  const s = states.find((x) => !x.done);
  return s ? STEPS.find((d) => d.key === s.key)! : null;
}

export const FIT_QUESTIONS: { q: string; why: string }[] = [
  { q: 'What’s the work, exactly?', why: 'Deliverables, pages, rounds of revisions, file formats.' },
  { q: 'Whose name is on it?', why: 'White label (theirs only) or credited to Thrive?' },
  { q: 'Who talks to the end client?', why: 'The prime only, or you on calls under their name?' },
  { q: 'Timeline and hard dates?', why: 'The end client’s launch and review dates.' },
  { q: 'How do they pay, and when?', why: 'Deposit? Net 15 or Net 30? Do they wait for their client to pay first?' },
  { q: 'What do they provide?', why: 'Brand files, copy, logins, a project manager.' },
  { q: 'Can you show it in your portfolio?', why: 'Now, after launch, or never?' },
  { q: 'Is there more coming?', why: 'A one-off or ongoing overflow work?' },
];

export const RED_FLAGS = [
  'They want you to start before anything is signed or paid.',
  '“We’ll pay you when our client pays us”, with no end date.',
  'No clear person who can approve your work.',
  'They want the source files and full rights before you’re paid in full.',
  'A price far below your price list “because there’s more work coming”.',
  'They ask you not to put anything in writing.',
];

export const AGREEMENT_TERMS: { term: string; want: string }[] = [
  { term: 'Scope', want: 'The accepted estimate is the scope. Changes need a new estimate or change order.' },
  { term: 'Payment', want: 'Deposit before work starts; balance Net 15. 30+ days late: work pauses and 1.5%/month is added.' },
  { term: 'Pay-when-paid', want: 'Strike it, or cap it: “due within 30 days of delivery, whether or not the end client has paid.”' },
  { term: 'Ownership (IP)', want: 'Rights pass to the prime once paid in full. Until then, the work stays yours.' },
  { term: 'Your tools', want: 'Your templates, code snippets and methods stay yours; they get a licence to use them in the deliverable.' },
  { term: 'White label', want: 'You don’t contact the end client or put your name on the work, unless the prime agrees.' },
  { term: 'Non-solicit', want: '12 months, both ways, only for clients met through them.' },
  { term: 'Confidentiality', want: 'Both sides keep the other’s and the end client’s information private.' },
  { term: 'Portfolio', want: 'You may show the work (no client name if needed) after launch or a stated date.' },
  { term: 'Revisions', want: 'Rounds included; extra rounds billed at your rate.' },
  { term: 'Liability', want: 'Capped at the fees paid for that job. Not responsible for content they supply.' },
  { term: 'Ending it', want: 'Either side, 14 days’ notice; work done to date is paid.' },
  { term: 'Contractor status', want: 'Independent contractor: your own tools, hours and taxes.' },
];

export const RULES = [
  'Everything runs through the prime: scope, money, approvals and changes.',
  'No work before the agreement is signed, the estimate accepted and the deposit paid.',
  'Price from your price list. Their markup is their business.',
  'One approver at the prime. Other feedback goes through them.',
  'The end client asks for something new: “Great idea, I’ll pass it to [prime contact]”, then a priced change order.',
  'Friday: a 3-line update to the prime (done, next, waiting on).',
];

export interface TemplateVars { first: string; endClient: string; work: string }

export const TEMPLATES: { key: string; name: string; subject: (v: TemplateVars) => string; body: (v: TemplateVars) => string }[] = [
  {
    key: 'after_fit',
    name: 'After the fit-check call',
    subject: (v) => `Estimate for ${v.work}`,
    body: (v) => `Hi ${v.first},\n\nThanks for thinking of Thrive for ${v.endClient}. Your estimate for ${v.work} is attached: [X] rounds of revisions, ready by [date].\n\nOnce it's accepted and the 50% deposit is in, I'll send our subcontractor agreement and get started. Who on your team will approve the work?\n\nLauren`,
  },
  {
    key: 'weekly',
    name: 'Friday update',
    subject: (v) => `${v.work}: this week`,
    body: (v) => `Hi ${v.first},\n\nQuick update on ${v.work} for ${v.endClient}:\n\nDone: [ ]\nNext: [ ]\nWaiting on: [ ]\n\nLauren`,
  },
  {
    key: 'change',
    name: 'End client asked for something new',
    subject: (v) => `${v.endClient}: a new request`,
    body: (v) => `Hi ${v.first},\n\n${v.endClient} asked for [request] on today's call. It's outside our estimate. I can add it for [$X], which moves delivery by [N] days.\n\nWant me to send the change order?\n\nLauren`,
  },
  {
    key: 'late',
    name: 'Payment is late',
    subject: (v) => `Invoice for ${v.work}`,
    body: (v) => `Hi ${v.first},\n\nINV-[xxx] for ${v.work} was due [date]. You can pay it in your portal here: https://thrivecreativestudios.org/portal/invoices\n\nUntil it's settled I'll pause new work, and pick it right back up once it's in. Thanks for sorting this quickly!\n\nLauren`,
  },
  {
    key: 'wrap',
    name: 'Handoff',
    subject: (v) => `${v.work}: your files`,
    body: (v) => `Hi ${v.first},\n\n${v.work} for ${v.endClient} is wrapped. Your final files are unlocked in your portal, with a one-page how-to, and the completion report is attached.\n\nI've removed my access; please change any passwords I used. Anything else coming up I can help with?\n\nLauren`,
  },
];
