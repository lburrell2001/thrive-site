export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { brandEmail, button as emailButton, rows } from '@/lib/emailLayout';

const NOTIFY_TO = 'hello@thrivecreativestudios.org';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  // Auth: client must pass their Supabase session token
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { proposalId?: string; fileName?: string; fileData?: string; mimeType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { proposalId, fileName, fileData, mimeType } = body;
  if (!proposalId || !fileName || !fileData) {
    return NextResponse.json({ error: 'proposalId, fileName, and fileData are required.' }, { status: 400 });
  }

  // Verify the proposal belongs to this user
  const { data: proposal } = await admin
    .from('portal_proposals')
    .select('id, name, client_id')
    .eq('id', proposalId)
    .eq('client_id', user.id)
    .single();
  if (!proposal) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });

  // Get client profile for the notification
  const { data: profile } = await admin
    .from('portal_clients')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single();

  // Upload signed file to storage
  const buf = Buffer.from(fileData, 'base64');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `proposals/${user.id}/signed/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await admin.storage
    .from('course-media')
    .upload(storagePath, buf, { contentType: mimeType ?? 'application/pdf', upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(storagePath);

  // Update proposal record
  const { error: updateErr } = await admin
    .from('portal_proposals')
    .update({ signed_file_url: publicUrl, signed_storage_path: storagePath, status: 'signed' })
    .eq('id', proposalId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log activity for the client
  await admin.from('portal_activity').insert({
    client_id: user.id,
    text: `You returned the signed proposal: ${proposal.name}`,
    dot_color: '#0cf574',
  });

  // Send email notification (never blocks response)
  const resendKey  = process.env.RESEND_API_KEY;
  const notifyFrom = process.env.CONTACT_NOTIFY_FROM;

  if (resendKey && notifyFrom) {
    try {
      const resend = new Resend(resendKey);
      const clientName = profile?.full_name ?? user.email ?? 'A client';
      const company    = profile?.company_name ? ` · ${profile.company_name}` : '';
      const subject    = `Signed proposal received — ${clientName}${company}`;

      const html = brandEmail({
        title: subject,
        eyebrow: 'Signed proposal received',
        heading: clientName,
        body: [
          rows([
            ...(profile?.company_name ? [{ label: 'Company', value: profile.company_name }] : []),
            { label: 'Email', value: user.email ?? '—', ...(user.email ? { href: `mailto:${user.email}` } : {}) },
            { label: 'Proposal', value: proposal.name },
          ]),
          emailButton(publicUrl, 'View the signed proposal'),
        ].join('\n'),
      });

      const text = [
        `Signed proposal received`,
        ``,
        `Client: ${clientName}${company}`,
        `Email: ${user.email ?? '—'}`,
        `Proposal: ${proposal.name}`,
        ``,
        `View signed file: ${publicUrl}`,
      ].join('\n');

      await resend.emails.send({
        from: notifyFrom,
        to: NOTIFY_TO,
        subject,
        html,
        text,
      });
    } catch (e) {
      console.error('Proposal notification email failed:', e);
    }
  }

  return NextResponse.json({ ok: true, signedUrl: publicUrl });
}
