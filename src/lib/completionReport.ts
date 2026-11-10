// Sending a completion report (migration 052): the PDF (made in the browser)
// emailed with a "Leave a review" button (a review request for the deal,
// Google first), a snapshot saved for the client's portal, and the project
// finished: progress 100%, Completed, and archived on the client's profile.
// Optionally the deal is closed too (it leaves the pipeline, stays Won).

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deliver, portalContact } from './clientNotify';
import { closeDeal } from './dealClose';
import { GOOGLE_REVIEW_URL } from './googleReview';
import { SITE_URL } from './seo';

export async function sendCompletionReport(
  db: SupabaseClient,
  projectId: string,
  input: { email: string; note?: string; pdf: string; data: Record<string, unknown>; closeDeal: boolean },
): Promise<{ ok: true; reviewUrl: string } | { ok: false; error: string }> {
  const { data: project } = await db.from('portal_projects').select('id, name, client_id, crm_deal_id').eq('id', projectId).maybeSingle();
  if (!project) return { ok: false, error: 'Project not found' };
  const found = await portalContact(db, project.client_id);
  if (!found) return { ok: false, error: 'Client not found' };
  const contact = { ...found, email: input.email };

  // A review request goes with it: the deal's open one if there is one, else a new one.
  const { data: deal } = project.crm_deal_id
    ? await db.from('crm_deals').select('contact_id, stage').eq('id', project.crm_deal_id).maybeSingle()
    : { data: null };
  const contactId = deal?.contact_id
    ?? (await db.from('crm_contacts').select('id').eq('portal_client_id', project.client_id).maybeSingle()).data?.id
    ?? null;
  let reviewUrl = GOOGLE_REVIEW_URL;
  let reviewId: string | null = null;
  if (contactId) {
    let q = db.from('reviews').select('id, token').eq('crm_contact_id', contactId).eq('status', 'requested');
    if (project.crm_deal_id) q = q.eq('crm_deal_id', project.crm_deal_id);
    const { data: open } = await q.order('requested_at', { ascending: false }).limit(1).maybeSingle();
    let token = open?.token as string | undefined;
    reviewId = open?.id ?? null;
    if (!token) {
      token = randomBytes(24).toString('base64url');
      const { data: made } = await db.from('reviews').insert({
        token, crm_contact_id: contactId, crm_deal_id: project.crm_deal_id ?? null,
        display_name: found.name || null, status: 'requested', requested_at: new Date().toISOString(),
      }).select('id').single();
      reviewId = made?.id ?? null;
    }
    if (reviewId) reviewUrl = `${SITE_URL}/review/${token}`;
  }

  const social = (input.data as { social?: unknown[] }).social?.length;
  const report = await deliver(db, contact, {
    subject: `${project.name}: your completion report`,
    eyebrow: 'Project complete',
    headline: `${project.name} is complete. Thank you for working with Thrive! Your completion report is attached: what we delivered, the timeline${social ? ', your growth' : ''}, and what comes next.`,
    note: input.note?.trim() || null,
    detail: 'If you were happy with the work, would you leave a short review? It takes two minutes on Google — it’s how other businesses find a small studio like mine — and with your okay it goes on our website too.',
    ctaUrl: reviewUrl, ctaLabel: 'Leave a review', sms: null,
  }, { email: true, sms: false }, {
    fromInbox: true,
    attachments: [{ filename: `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'Project'} - Completion report.pdf`, content: input.pdf, contentType: 'application/pdf' }],
  });
  if (report.email.status !== 'sent') return { ok: false, error: report.email.error ?? 'The email did not send' };

  await db.from('project_reports').insert({ project_id: projectId, client_id: project.client_id, sent_to: input.email, data: input.data });
  if (reviewId) {
    // Logged like any review request, so Home stops suggesting one for this deal.
    await db.from('client_reminders').insert({
      target_type: 'review', target_id: reviewId, portal_client_id: project.client_id,
      subject: `${project.name}: your completion report`, email_status: 'sent', email_to: input.email, sms_status: 'skipped',
    });
  }
  // Finished: 100%, Completed, archived on the client's profile.
  await db.from('portal_projects').update({ status: 'completed', progress: 100, completed_at: new Date().toISOString(), archived: true }).eq('id', projectId);
  await db.from('portal_activity').insert({ client_id: project.client_id, text: `${project.name} complete — completion report sent`, dot_color: '#0cf574', project_name: project.name });
  if (project.crm_deal_id && contactId) {
    await db.from('crm_activities').insert({ contact_id: contactId, deal_id: project.crm_deal_id, kind: 'email', body: `Sent the completion report for ${project.name}`, metadata: { project_id: projectId, to: input.email } });
  }
  if (input.closeDeal && project.crm_deal_id && deal?.stage === 'won') {
    await closeDeal(db, project.crm_deal_id, 'manual', 'Completion report sent').catch((e) => console.error('[report] close deal', e));
  }
  return { ok: true, reviewUrl };
}
