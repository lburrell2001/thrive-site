export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const NOTIFY_TO = 'hello@thrivecreativestudios.org';

function escHtml(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  // Send email notification (never blocks response)
  const resendKey  = process.env.RESEND_API_KEY;
  const notifyFrom = process.env.CONTACT_NOTIFY_FROM;

  if (resendKey && notifyFrom) {
    try {
      const resend = new Resend(resendKey);
      const clientName = profile?.full_name ?? user.email ?? 'A client';
      const company    = profile?.company_name ? ` · ${profile.company_name}` : '';
      const subject    = `Signed proposal received — ${clientName}${company}`;

      const html = `
        <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:28px;">
            <div style="background:linear-gradient(135deg,#ff2ea6,#7c3aed,#22d3ee);padding:2px;border-radius:18px;">
              <div style="background:#0b0b0f;border-radius:16px;padding:22px 22px 18px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:14px;height:14px;border-radius:999px;background:#ff2ea6;box-shadow:0 0 0 4px rgba(255,46,166,.18);"></div>
                  <div style="color:#fff;font-weight:900;font-size:16px;">Thrive Creative Studios</div>
                </div>
                <div style="margin-top:8px;color:#d7d7e0;font-size:13px;">A client has uploaded their signed proposal.</div>
              </div>
            </div>

            <div style="margin-top:16px;background:#11111a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;">
              <div style="color:#fff;font-size:18px;font-weight:900;margin-bottom:4px;">
                ${escHtml(clientName)}${escHtml(company ? ` ${company}` : '')}
              </div>
              <div style="color:#aab0c0;font-size:13px;margin-bottom:20px;">
                ${escHtml(user.email ?? '')}
              </div>

              <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px 16px;margin-bottom:16px;">
                <div style="color:#aab0c0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Proposal</div>
                <div style="color:#fff;font-size:14px;font-weight:700;">${escHtml(proposal.name)}</div>
              </div>

              <a href="${publicUrl}"
                 style="display:inline-block;background:#ff2ea6;color:#0b0b0f;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;">
                View Signed Proposal ↗
              </a>
            </div>

            <div style="margin-top:14px;color:#6c7386;font-size:12px;text-align:center;">
              Sent from Thrive Client Portal · ${new Date().toLocaleString('en-US')}
            </div>
          </div>
        </div>
      `;

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
