// The Security dashboard in admin (/admin/security): live checks of how well
// the site protects the personal data it holds. Everything here only reads.
//
// - Exposure checks query the database and storage with the PUBLIC anon key —
//   exactly what any visitor's browser could do — and fail if anything private
//   comes back.
// - Setup checks look at admin sign-in, Supabase settings, secrets being set
//   (never their values) and the live site's security headers.
// - Activity, data inventory and the vault access log are for keeping an eye
//   on who touched what.
// - The checklist holds what the site can't verify by itself (2FA on outside
//   accounts…); each item is confirmed by hand and goes stale after 90 days.

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_ROLE, passcodeRetired } from '@/lib/adminAuth';
import { DOC_BUCKET } from '@/lib/clientDocs';
import { SITE_URL } from '@/lib/seo';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type Check = { id: string; group: string; title: string; status: CheckStatus; detail: string; fix?: string };

export const CHECKLIST = [
  { id: 'mfa_supabase', title: 'Two-factor sign-in on Supabase', detail: 'Supabase holds every record. Account → Security.' },
  { id: 'mfa_vercel', title: 'Two-factor sign-in on Vercel', detail: 'Vercel holds the site’s secret keys.' },
  { id: 'mfa_stripe', title: 'Two-factor sign-in on Stripe', detail: 'Payments and payouts.' },
  { id: 'mfa_github', title: 'Two-factor sign-in on GitHub', detail: 'Anyone who can push code can change the site.' },
  { id: 'mfa_email', title: 'Two-factor on your email, Resend and Twilio', detail: 'Email resets every other password.' },
  { id: 'authenticator_backup', title: 'Authenticator app is backed up', detail: '1Password or Authy sync, or a second phone paired.' },
  { id: 'devices', title: 'Your computer and phone are locked and up to date', detail: 'Screen lock, disk encryption (FileVault), latest OS.' },
  { id: 'old_data', title: 'Reviewed and deleted data you no longer need', detail: 'Old inquiries, lost leads, finished clients’ logins in the vault.' },
  { id: 'privacy_page', title: 'Privacy page still matches what the site collects', detail: '/privacy — analytics, forms, texts, Opinly.' },
] as const;
export type ChecklistId = (typeof CHECKLIST)[number]['id'];
export const CHECKLIST_STALE_DAYS = 90;
const CHECKLIST_KEY = 'security_checklist';

export type SecurityReport = {
  generatedAt: string;
  score: { pass: number; warn: number; fail: number };
  checks: Check[];
  checklist: { id: string; title: string; detail: string; confirmedAt: string | null; stale: boolean }[];
  activity: { label: string; last24h: number; last7d: number }[];
  inventory: { label: string; count: number | null; note: string }[];
  vaultViews: { label: string; client: string; viewedBy: string | null; viewedAt: string }[];
  admins: { email: string; authenticator: boolean; lastSignIn: string | null }[];
};

// Tables that hold personal data and must return nothing to the public key.
const PRIVATE_TABLES = [
  'portal_invoices', 'portal_clients', 'portal_credentials', 'portal_files', 'portal_proposals', 'portal_requests',
  'crm_contacts', 'crm_deals', 'crm_activities', 'contact_inquiries', 'bookings', 'client_reminders',
  'proposal_clients', 'proposals', 'proposal_signatures', 'email_replies', 'prospect_emails', 'newsletter_sends',
  'marketing_recipients', 'site_pageviews', 'admin_config', 'rate_limit_hits',
];

const DAY = 86_400_000;

async function count(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  return error ? null : n ?? 0;
}

async function exposureChecks(): Promise<Check[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  const exposed: string[] = [];
  await Promise.all(PRIVATE_TABLES.map(async (table) => {
    const { data, error } = await anon.from(table).select('*').limit(1);
    if (!error && (data?.length ?? 0) > 0) exposed.push(table);
  }));

  const listed: string[] = [];
  for (const [bucket, prefix] of [['course-media', 'proposals'], ['course-media', 'client-files'], [DOC_BUCKET, 'proposals'], [DOC_BUCKET, 'client-files']] as const) {
    const { data } = await anon.storage.from(bucket).list(prefix, { limit: 1 });
    if ((data?.length ?? 0) > 0) listed.push(`${bucket}/${prefix}`);
  }

  return [
    {
      id: 'tables',
      group: 'What the public can see',
      title: 'Private records are hidden from the public',
      status: exposed.length ? 'fail' : 'pass',
      detail: exposed.length
        ? `Anyone could read: ${exposed.join(', ')}.`
        : `Checked ${PRIVATE_TABLES.length} tables with the public key — none returned a record.`,
      fix: exposed.length ? 'Row level security is missing a rule on these tables. Ask for a migration that locks them, like 038.' : undefined,
    },
    {
      id: 'storage_listing',
      group: 'What the public can see',
      title: 'Client documents can’t be browsed',
      status: listed.length ? 'fail' : 'pass',
      detail: listed.length ? `Files can be listed in ${listed.join(', ')}.` : 'The public key can’t list proposals or client files.',
    },
  ];
}

async function storageChecks(db: SupabaseClient): Promise<Check[]> {
  const { data: buckets } = await db.storage.listBuckets();
  const docs = buckets?.find((b) => b.id === DOC_BUCKET);
  const strays: string[] = [];
  for (const prefix of ['proposals', 'client-files']) {
    const { data } = await db.storage.from('course-media').list(prefix, { limit: 1 });
    if ((data?.length ?? 0) > 0) strays.push(prefix);
  }
  const publicLinks =
    ((await count(db, 'portal_files', (q) => q.like('file_url', '%/object/public/course-media/%'))) ?? 0) +
    ((await count(db, 'portal_proposals', (q) => q.or('file_url.like.%/object/public/course-media/%,signed_file_url.like.%/object/public/course-media/%'))) ?? 0);

  return [
    {
      id: 'doc_bucket',
      group: 'Client documents',
      title: 'Documents are kept in private storage',
      status: !docs ? 'fail' : docs.public ? 'fail' : 'pass',
      detail: !docs ? 'The private client-documents bucket is missing.' : docs.public ? 'The client-documents bucket is set to public.' : 'Proposals and client files are only reachable through links that expire after an hour.',
      fix: docs?.public ? 'Supabase → Storage → client-documents → turn “Public bucket” off.' : undefined,
    },
    {
      id: 'doc_strays',
      group: 'Client documents',
      title: 'No client documents in public storage',
      status: strays.length || publicLinks ? 'fail' : 'pass',
      detail: strays.length || publicLinks
        ? `${strays.length ? `Files found in course-media/${strays.join(', course-media/')}. ` : ''}${publicLinks ? `${publicLinks} record(s) still link to public files.` : ''}`
        : 'Nothing under proposals/ or client-files/ in the public bucket, and no records link there.',
      fix: strays.length || publicLinks ? 'Run the document move again (ask Claude: “move client documents to private storage”).' : undefined,
    },
  ];
}

async function accessChecks(db: SupabaseClient, admins: SecurityReport['admins']): Promise<Check[]> {
  const retired = await passcodeRetired(db);
  const withMfa = admins.filter((a) => a.authenticator);
  const without = admins.filter((a) => !a.authenticator);

  let signupsOff: boolean | null = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) signupsOff = ((await res.json()) as { disable_signup?: boolean }).disable_signup === true;
  } catch { /* reported as unknown below */ }

  return [
    {
      id: 'admin_account',
      group: 'Admin sign-in',
      title: 'Admin uses an account with an authenticator code',
      status: withMfa.length ? 'pass' : 'fail',
      detail: withMfa.length
        ? `${withMfa.map((a) => a.email).join(', ')} — password plus authenticator code.`
        : admins.length ? 'An admin account exists but its authenticator isn’t paired yet.' : 'No admin account yet — admin still relies on the shared passcode.',
      fix: withMfa.length ? undefined : 'Create your account below and sign in with it once to pair your phone.',
    },
    {
      id: 'passcode',
      group: 'Admin sign-in',
      title: 'Shared passcode is turned off',
      status: retired ? 'pass' : 'fail',
      detail: retired ? 'Only admin accounts can sign in.' : 'The passcode still opens admin. Anyone who learns it gets every client record.',
      fix: retired ? undefined : 'Once signed in with your account, use “Turn off the passcode” below.',
    },
    ...(without.length ? [{
      id: 'admin_unpaired',
      group: 'Admin sign-in',
      title: 'Every admin account has an authenticator',
      status: 'warn' as const,
      detail: `${without.map((a) => a.email).join(', ')} can’t sign in until an authenticator is paired.`,
    }] : []),
    {
      id: 'signups',
      group: 'Admin sign-in',
      title: 'Strangers can’t create accounts',
      status: signupsOff === null ? 'warn' : signupsOff ? 'pass' : 'fail',
      detail: signupsOff === null ? 'Couldn’t read the Supabase sign-up setting.' : signupsOff ? 'New sign-ups are off in Supabase; client logins are created by you.' : 'Anyone can create a Supabase account and get a portal login.',
      fix: signupsOff ? undefined : 'Supabase → Authentication → Sign In / Providers → turn off “Allow new users to sign up”.',
    },
  ];
}

function secretChecks(): Check[] {
  const has = (k: string) => !!process.env[k];
  const required = ['SUPABASE_SERVICE_ROLE_KEY', 'PORTAL_CREDENTIALS_KEY', 'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET', 'RESEND_WEBHOOK_SECRET'];
  const missing = required.filter((k) => !has(k));
  return [
    {
      id: 'secrets',
      group: 'Keys and secrets',
      title: 'Security keys are set',
      status: missing.length ? 'fail' : 'pass',
      detail: missing.length ? `Missing: ${missing.join(', ')}.` : 'Vault encryption key, webhook signing secrets and the cron secret are all set (values are never shown).',
      fix: missing.length ? 'Add them in Vercel → Project → Settings → Environment Variables.' : undefined,
    },
    {
      id: 'analytics_salt',
      group: 'Keys and secrets',
      title: 'Visitor hashing has its own key',
      status: has('ANALYTICS_SALT') ? 'pass' : 'warn',
      detail: has('ANALYTICS_SALT') ? 'Visitor IPs are hashed with a dedicated key.' : 'Visitor IPs are hashed with the database key; a separate ANALYTICS_SALT is better practice.',
      fix: has('ANALYTICS_SALT') ? undefined : 'Add ANALYTICS_SALT (any long random string) in Vercel.',
    },
  ];
}

async function headerChecks(): Promise<Check[]> {
  const want: [string, string][] = [
    ['strict-transport-security', 'HTTPS only'],
    ['x-content-type-options', 'no file-type sniffing'],
    ['x-frame-options', 'can’t be framed by other sites'],
    ['referrer-policy', 'private links don’t leak'],
    ['content-security-policy', 'content security policy'],
  ];
  try {
    const res = await fetch(SITE_URL, { method: 'HEAD', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const missing = want.filter(([h]) => !res.headers.get(h));
    return [{
      id: 'headers',
      group: 'The live website',
      title: 'Security headers are sent',
      status: missing.length ? 'warn' : 'pass',
      detail: missing.length ? `Missing on ${SITE_URL}: ${missing.map(([, d]) => d).join(', ')}.` : `${SITE_URL} sends all ${want.length}: ${want.map(([, d]) => d).join(', ')}.`,
    }];
  } catch {
    return [{ id: 'headers', group: 'The live website', title: 'Security headers are sent', status: 'warn', detail: `Couldn’t reach ${SITE_URL} to check.` }];
  }
}

async function adminAccounts(db: SupabaseClient): Promise<SecurityReport['admins']> {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const admins = (data?.users ?? []).filter((u) => u.app_metadata?.role === ADMIN_ROLE);
  return Promise.all(admins.map(async (u) => {
    const { data: f } = await db.auth.admin.mfa.listFactors({ userId: u.id });
    return {
      email: u.email ?? '',
      authenticator: (f?.factors ?? []).some((x) => x.status === 'verified'),
      lastSignIn: u.last_sign_in_at ?? null,
    };
  }));
}

async function activity(db: SupabaseClient): Promise<SecurityReport['activity']> {
  const rows: [string, string][] = [
    ['admin_passcode', 'Wrong admin passcodes'],
    ['portal_code', 'Portal sign-in codes requested'],
    ['contact', 'Contact form messages'],
    ['booking', 'Call bookings'],
  ];
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  // rate_limit_hits keeps 30 days (src/lib/rateLimit.ts).
  return Promise.all(rows.map(async ([bucket, label]) => ({
    label,
    last24h: (await count(db, 'rate_limit_hits', (q) => q.eq('bucket', bucket).gte('created_at', since(DAY)))) ?? 0,
    last7d: (await count(db, 'rate_limit_hits', (q) => q.eq('bucket', bucket).gte('created_at', since(7 * DAY)))) ?? 0,
  })));
}

async function inventory(db: SupabaseClient): Promise<SecurityReport['inventory']> {
  const twoYears = new Date(Date.now() - 730 * DAY).toISOString();
  const items: [string, string, Promise<number | null>][] = [
    ['CRM contacts', 'Names, emails, phones, notes', count(db, 'crm_contacts')],
    ['Portal clients', 'Client logins and profiles', count(db, 'portal_clients')],
    ['Saved logins in the vault', 'Encrypted website and account passwords', count(db, 'portal_credentials')],
    ['Contact form inquiries', 'Names, emails, messages', count(db, 'contact_inquiries')],
    ['Inquiries older than 2 years', 'Worth reviewing — delete what you no longer need', count(db, 'contact_inquiries', (q) => q.lt('created_at', twoYears))],
    ['Booked calls', 'Names, emails, phones', count(db, 'bookings')],
    ['Proposal signatures', 'Signer names, emails, IP addresses', count(db, 'proposal_signatures')],
    ['Invoices', 'Amounts and Stripe references (no card numbers — Stripe holds those)', count(db, 'portal_invoices')],
    ['Client documents', 'Proposals and delivered files', Promise.all([count(db, 'portal_proposals'), count(db, 'portal_files')]).then(([a, b]) => (a ?? 0) + (b ?? 0))],
    ['Newsletter subscribers', 'Emails with confirmed consent', count(db, 'crm_contacts', (q) => q.eq('newsletter_status', 'subscribed'))],
  ];
  return Promise.all(items.map(async ([label, note, n]) => ({ label, note, count: await n })));
}

async function vaultViews(db: SupabaseClient): Promise<SecurityReport['vaultViews']> {
  const { data } = await db
    .from('portal_credentials')
    .select('label, client_id, last_viewed_at, last_viewed_by')
    .gte('last_viewed_at', new Date(Date.now() - 30 * DAY).toISOString())
    .order('last_viewed_at', { ascending: false })
    .limit(20);
  if (!data?.length) return [];
  const ids = [...new Set(data.map((r) => r.client_id))];
  const { data: clients } = await db.from('portal_clients').select('id, full_name, company_name').in('id', ids);
  const name = new Map((clients ?? []).map((c) => [c.id, c.company_name || c.full_name || 'Client']));
  return data.map((r) => ({ label: r.label, client: name.get(r.client_id) ?? 'Client', viewedBy: r.last_viewed_by, viewedAt: r.last_viewed_at }));
}

export async function loadChecklist(db: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await db.from('admin_config').select('value').eq('key', CHECKLIST_KEY).maybeSingle();
  try { return data?.value ? JSON.parse(String(data.value)) as Record<string, string> : {}; } catch { return {}; }
}

export async function confirmChecklistItem(db: SupabaseClient, id: string, confirmed: boolean): Promise<void> {
  if (!CHECKLIST.some((c) => c.id === id)) throw new Error('Unknown checklist item');
  const current = await loadChecklist(db);
  if (confirmed) current[id] = new Date().toISOString(); else delete current[id];
  const { error } = await db.from('admin_config')
    .upsert({ key: CHECKLIST_KEY, value: JSON.stringify(current), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error('Could not save');
}

export async function buildSecurityReport(db: SupabaseClient): Promise<SecurityReport> {
  const admins = await adminAccounts(db);
  const [exposure, storage, access, headers, act, inv, views, confirmed] = await Promise.all([
    exposureChecks(), storageChecks(db), accessChecks(db, admins), headerChecks(), activity(db), inventory(db), vaultViews(db), loadChecklist(db),
  ]);
  const checks = [...access, ...exposure, ...storage, ...secretChecks(), ...headers];

  const failedPasscodes = act.find((a) => a.label === 'Wrong admin passcodes')?.last24h ?? 0;
  if (failedPasscodes >= 8) {
    checks.push({
      id: 'brute_force', group: 'Admin sign-in', title: 'No one is guessing the passcode', status: 'warn',
      detail: `${failedPasscodes} wrong passcodes in the last 24 hours. Each address is locked out after 8.`,
      fix: 'Turn off the passcode once your account is set up.',
    });
  }

  const checklist = CHECKLIST.map((c) => {
    const at = confirmed[c.id] ?? null;
    return { id: c.id, title: c.title, detail: c.detail, confirmedAt: at, stale: !at || Date.now() - Date.parse(at) > CHECKLIST_STALE_DAYS * DAY };
  });

  return {
    generatedAt: new Date().toISOString(),
    score: {
      pass: checks.filter((c) => c.status === 'pass').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      fail: checks.filter((c) => c.status === 'fail').length,
    },
    checks,
    checklist,
    activity: act,
    inventory: inv,
    vaultViews: views,
    admins,
  };
}
