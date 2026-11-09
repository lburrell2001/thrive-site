export const runtime = 'nodejs';

// Send an estimate: a short email in the Thrive layout, from her Outlook when
// it's connected, with a button to the estimate's own page (/e/<id>?t=…,
// migration 051) where the client can export the PDF or accept it. The PDF
// (made in the browser, exactly what Lauren sees) is attached too. Marks a
// draft estimate Sent, remembers who it went to, and logs it on the timeline.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { crmContact, deliver, portalContact, type Contact } from '@/lib/clientNotify';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';
import type { SupabaseClient } from '@supabase/supabase-js';

type Ctx = { params: Promise<{ id: string }> };

type EstimateRow = {
  id: string; estimate_number: string; title: string; client_name: string; total_cents: number;
  valid_until: string | null; status: string; portal_client_id: string | null; crm_contact_id: string | null;
  access_token?: string | null;
};

async function recipient(db: SupabaseClient, est: EstimateRow): Promise<{ contact: Contact | null; contactId: string | null }> {
  if (est.portal_client_id) {
    const { data: c } = await db.from('crm_contacts').select('id').eq('portal_client_id', est.portal_client_id).maybeSingle();
    return { contact: await portalContact(db, est.portal_client_id), contactId: c?.id ?? null };
  }
  if (est.crm_contact_id) return { contact: await crmContact(db, est.crm_contact_id), contactId: est.crm_contact_id };
  return { contact: null, contactId: null };
}

async function load(db: SupabaseClient, id: string) {
  const { data } = await db.from('estimates')
    .select('*')
    .eq('id', id).maybeSingle();
  return data as EstimateRow | null;
}

/** Who it would go to, for the Send dialog. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const est = await load(auth.db, id);
  if (!est) return badRequest('Estimate not found', 404);
  const { contact } = await recipient(auth.db, est);
  return NextResponse.json({ ok: true, data: { email: contact?.email ?? '', name: contact?.name || est.client_name } });
}

const sendSchema = z.object({
  email: z.string().trim().email('Enter their email address'),
  note: z.string().max(2000).optional(),
  /** The PDF as base64, under ~3 MB. */
  pdf: z.string().min(100).max(4_000_000),
});

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const est = await load(db, id);
  if (!est) return badRequest('Estimate not found', 404);

  const { contact: found, contactId } = await recipient(db, est);
  const name = found?.name || est.client_name || '';
  const contact: Contact = {
    ...(found ?? { portalClientId: null, proposalClientId: null, phone: null, smsOptIn: false, smsSource: null }),
    name,
    firstName: name.trim().split(/\s+/)[0] || 'there',
    email: parsed.data.email,
  };

  const total = formatLineMoney(est.total_cents);
  const until = est.valid_until
    ? new Date(`${est.valid_until}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const report = await deliver(db, contact, {
    subject: `Estimate ${est.estimate_number}${est.title ? ` — ${est.title}` : ''}`,
    eyebrow: 'Your estimate',
    headline: est.access_token
      ? `Here’s your estimate${est.title ? ` for ${est.title}` : ''}: ${total}. Open it to look it over — at the bottom you can save it as a PDF or accept it, and your invoice will be ready in your portal straight away.`
      : `Here’s your estimate${est.title ? ` for ${est.title}` : ''}: ${total}. The full estimate is attached as a PDF.`,
    detail: [est.title && `Project: ${est.title}`, `Estimate: ${est.estimate_number}`, `Total: ${total}`, until && `Good until: ${until}`].filter(Boolean).join('\n'),
    note: parsed.data.note?.trim() || null,
    ctaUrl: est.access_token ? `${SITE_URL}/e/${est.id}?t=${est.access_token}` : '',
    ctaLabel: est.access_token ? 'View & accept your estimate' : '',
    sms: null,
  }, { email: true, sms: false }, {
    fromInbox: true,
    attachments: [{ filename: `Estimate-${est.estimate_number}.pdf`, content: parsed.data.pdf, contentType: 'application/pdf' }],
  });
  if (report.email.status !== 'sent') return badRequest(report.email.error ?? 'The email did not send');

  await db.from('estimates').update({
    ...(est.status === 'draft' ? { status: 'sent' } : {}),
    sent_to: parsed.data.email.toLowerCase(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (contactId) {
    await db.from('crm_activities').insert({
      contact_id: contactId, kind: 'email',
      body: `Sent estimate ${est.estimate_number}${est.title ? ` (${est.title})` : ''}: ${total}`,
      metadata: { estimate_id: id, to: parsed.data.email },
    });
  }
  return NextResponse.json({ ok: true, data: { to: parsed.data.email } });
}
