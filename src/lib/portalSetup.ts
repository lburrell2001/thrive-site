// Setting up a client's portal for a new project (migration 057). Each project
// that isn't set up shows a checklist on the client tab and in Home's Needs you:
//   invite        the "your portal is ready" email went out, or they've signed in
//   questionnaire a questionnaire is assigned to them
//   billing       an estimate, proposal or invoice is on the project's deal (or name)
//   milestones    the project has at least one milestone
// When every step is done, or Lauren skips it, portal_projects.setup_done_at is set.
// A new client's first project must be set up (`required`: no skipping, listed
// on Home). For an existing client — one who already had a project — it's
// optional: a quieter prompt on their Client tab only, which can be dismissed.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deliver, portalContact } from './clientNotify';
import { SITE_URL } from './seo';

export const SETUP_STEPS = ['invite', 'questionnaire', 'billing', 'milestones'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export type ProjectSetup = {
  project_id: string; project_name: string; created_at: string;
  client_id: string; client_name: string; contact_id: string | null; deal_id: string | null;
  steps: Record<SetupStep, boolean>;
  invited_at: string | null; signed_in: boolean;
  /** Their first project: setting up the portal isn't optional. */
  required: boolean;
};

const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Projects still to set up (all clients, or one). Empty before migration 057. */
export async function portalSetups(db: SupabaseClient, opts: { clientId?: string } = {}): Promise<ProjectSetup[]> {
  let q = db.from('portal_projects').select('id, name, client_id, crm_deal_id, created_at')
    .is('setup_done_at', null).eq('archived', false).is('completed_at', null).order('created_at', { ascending: false });
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  const { data: projects, error } = await q;
  if (error || !projects?.length) return [];

  const clientIds = [...new Set(projects.map((p) => p.client_id as string))];
  const dealIds = projects.map((p) => p.crm_deal_id).filter(Boolean) as string[];
  const [allProjects, clients, contacts, invites, questionnaires, invoices, estimates, proposals, milestones, users] = await Promise.all([
    db.from('portal_projects').select('id, client_id, created_at').in('client_id', clientIds),
    db.from('portal_clients').select('id, full_name, company_name').in('id', clientIds),
    db.from('crm_contacts').select('id, portal_client_id').in('portal_client_id', clientIds),
    db.from('client_reminders').select('portal_client_id, created_at').eq('target_type', 'portal_invite').eq('email_status', 'sent').in('portal_client_id', clientIds).order('created_at', { ascending: false }),
    db.from('client_questionnaires').select('client_id').in('client_id', clientIds),
    db.from('portal_invoices').select('client_id, project_name, crm_deal_id').in('client_id', clientIds),
    dealIds.length ? db.from('estimates').select('crm_deal_id').in('crm_deal_id', dealIds) : Promise.resolve({ data: [] as { crm_deal_id: string }[] }),
    dealIds.length ? db.from('proposals').select('crm_deal_id').in('crm_deal_id', dealIds) : Promise.resolve({ data: [] as { crm_deal_id: string }[] }),
    db.from('portal_milestones').select('client_id, project_name').in('client_id', clientIds),
    Promise.all(clientIds.map((id) => db.auth.admin.getUserById(id).then((r) => [id, Boolean(r.data.user?.last_sign_in_at)] as const).catch(() => [id, false] as const))),
  ]);
  const signedIn = new Map(users);
  const dealsWithQuote = new Set([...(estimates.data ?? []), ...(proposals.data ?? [])].map((r) => r.crm_deal_id));

  const out: ProjectSetup[] = [];
  for (const p of projects) {
    const client = clients.data?.find((c) => c.id === p.client_id);
    const invite = invites.data?.find((r) => r.portal_client_id === p.client_id) ?? null;
    const steps: Record<SetupStep, boolean> = {
      invite: Boolean(invite) || Boolean(signedIn.get(p.client_id)),
      questionnaire: Boolean(questionnaires.data?.some((r) => r.client_id === p.client_id)),
      billing: Boolean((p.crm_deal_id && dealsWithQuote.has(p.crm_deal_id))
        || invoices.data?.some((i) => i.client_id === p.client_id && ((p.crm_deal_id && i.crm_deal_id === p.crm_deal_id) || lower(i.project_name) === lower(p.name)))),
      milestones: Boolean(milestones.data?.some((m) => m.client_id === p.client_id && lower(m.project_name) === lower(p.name))),
    };
    // All done: it leaves the list for good.
    if (SETUP_STEPS.every((k) => steps[k])) {
      await db.from('portal_projects').update({ setup_done_at: new Date().toISOString() }).eq('id', p.id);
      continue;
    }
    out.push({
      project_id: p.id, project_name: p.name, created_at: p.created_at,
      client_id: p.client_id, client_name: client?.company_name || client?.full_name || 'Client',
      contact_id: contacts.data?.find((c) => c.portal_client_id === p.client_id)?.id ?? null,
      deal_id: p.crm_deal_id, steps, invited_at: invite?.created_at ?? null, signed_in: Boolean(signedIn.get(p.client_id)),
      // Required unless they already had a project before this one.
      required: !allProjects.data?.some((o) => o.client_id === p.client_id && o.id !== p.id && o.created_at < p.created_at),
    });
  }
  return out;
}

export async function skipSetup(db: SupabaseClient, projectId: string) {
  const { error } = await db.from('portal_projects').update({ setup_done_at: new Date().toISOString() }).eq('id', projectId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** "Your client portal is ready": email (and a text if they've opted in), logged as a portal_invite reminder. */
export async function sendPortalInvite(db: SupabaseClient, clientId: string, input: { projectName?: string | null; note?: string | null } = {}) {
  const contact = await portalContact(db, clientId);
  if (!contact?.email) return { ok: false as const, error: 'No email on this client' };
  const project = input.projectName?.trim();
  const subject = 'Your Thrive client portal is ready';
  const report = await deliver(db, contact, {
    subject,
    eyebrow: 'Your client portal',
    headline: `Hi ${contact.firstName}, your Thrive client portal is ready${project ? ` for ${project}` : ''}. It’s where you’ll find your project’s progress, estimates and invoices, files, and a few questions to get us started.`,
    detail: `Sign in with this email address (${contact.email}). We’ll email you a 6-digit code, so there’s no password to remember.`,
    note: input.note?.trim() || null,
    ctaUrl: `${SITE_URL}/portal`,
    ctaLabel: 'Open your portal',
    sms: 'your client portal is ready. Sign in with your email here:',
  }, { email: true, sms: true }, { fromInbox: true });
  await db.from('client_reminders').insert({
    target_type: 'portal_invite', target_id: clientId, portal_client_id: clientId, subject, note: input.note?.trim() || null,
    email_status: report.email.status, email_to: contact.email, email_error: report.email.error ?? null,
    sms_status: report.sms.status, sms_to: report.sms.to, sms_error: report.sms.error ?? null,
  });
  if (report.email.status !== 'sent') return { ok: false as const, error: report.email.error ?? 'The email did not send' };
  return { ok: true as const, to: contact.email, texted: report.sms.status === 'sent' };
}
