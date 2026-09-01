export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { encryptSecret, decryptSecret, vaultKeyReady } from '@/lib/credentialCrypto';

const NOTIFY_TO = 'hello@thrivecreativestudios.org';

const CATEGORIES = ['website_host', 'domain', 'cms', 'ftp', 'analytics', 'social', 'email', 'other'];

/** Columns safe to hand back to the browser — never the ciphertext or the secret. */
const LIST_COLUMNS =
  'id, project_id, label, category, site_url, username, secret_encrypted, notes_encrypted, last_viewed_at, last_viewed_by, created_at, updated_at';

interface CredentialRow {
  id: string;
  project_id: string | null;
  label: string;
  category: string;
  site_url: string;
  username: string;
  secret_encrypted: string;
  notes_encrypted: string;
  last_viewed_at: string | null;
  last_viewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function toSummary(row: CredentialRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    label: row.label,
    category: row.category,
    site_url: row.site_url,
    username: row.username,
    has_secret: !!row.secret_encrypted,
    has_notes: !!row.notes_encrypted,
    last_viewed_at: row.last_viewed_at,
    last_viewed_by: row.last_viewed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function escHtml(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tells Thrive a credential landed. Deliberately carries no secret material. */
async function notifyThrive(clientName: string, clientEmail: string, label: string, verb: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyFrom = process.env.CONTACT_NOTIFY_FROM;
  if (!resendKey || !notifyFrom) return;
  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: notifyFrom,
      to: NOTIFY_TO,
      subject: `Secure vault ${verb} — ${clientName}`,
      text: [
        `${clientName} (${clientEmail}) ${verb} a credential in their secure vault.`,
        ``,
        `Entry: ${label}`,
        ``,
        `The login itself is not included in this email — open the client's Profile tab in the admin portal to reveal it.`,
      ].join('\n'),
      html: `
        <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:28px;">
            <div style="background:linear-gradient(135deg,#ff2ea6,#7c3aed,#22d3ee);padding:2px;border-radius:18px;">
              <div style="background:#0b0b0f;border-radius:16px;padding:20px 22px 16px;">
                <div style="color:#fff;font-weight:900;font-size:15px;">Thrive Creative Studios</div>
                <div style="margin-top:6px;color:#d7d7e0;font-size:13px;">A client ${escHtml(verb)} a secure credential.</div>
              </div>
            </div>
            <div style="margin-top:16px;background:#11111a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;">
              <div style="color:#fff;font-size:17px;font-weight:900;margin-bottom:2px;">${escHtml(clientName)}</div>
              <div style="color:#aab0c0;font-size:13px;margin-bottom:18px;">${escHtml(clientEmail)}</div>
              <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px 16px;">
                <div style="color:#aab0c0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Entry</div>
                <div style="color:#fff;font-size:14px;font-weight:700;">${escHtml(label)}</div>
              </div>
              <div style="color:#6c7386;font-size:12px;line-height:1.6;margin-top:16px;">
                The login is not included in this email. Open the client's Profile tab in the admin portal to reveal it.
              </div>
            </div>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Vault notification email failed:', e);
  }
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }
  if (!vaultKeyReady()) {
    return NextResponse.json(
      { error: 'The secure vault is not configured yet. Please contact Thrive.' },
      { status: 503 },
    );
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const action = body.action as string;

  /** Only lets a credential be pinned to a project the caller actually owns. */
  async function ownedProjectId(projectId: unknown): Promise<string | null> {
    if (!projectId || typeof projectId !== 'string') return null;
    const { data } = await admin
      .from('portal_projects').select('id').eq('id', projectId).eq('client_id', user!.id).single();
    return data ? projectId : null;
  }

  try {
    switch (action) {

      case 'list': {
        const { data, error } = await admin
          .from('portal_credentials')
          .select(LIST_COLUMNS)
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, data: (data as CredentialRow[] ?? []).map(toSummary) });
      }

      case 'reveal': {
        const id = body.id as string;
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
        const { data: row } = await admin
          .from('portal_credentials')
          .select('secret_encrypted, notes_encrypted')
          .eq('id', id)
          .eq('client_id', user.id)
          .single();
        if (!row) return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
        return NextResponse.json({
          ok: true,
          data: {
            secret: decryptSecret(row.secret_encrypted ?? ''),
            notes: decryptSecret(row.notes_encrypted ?? ''),
          },
        });
      }

      case 'create': {
        const { label, category, site_url, username, secret, notes, projectId } =
          body as Record<string, string | undefined>;
        if (!label?.trim()) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });

        const row: Record<string, unknown> = {
          client_id: user.id,
          label: label.trim(),
          category: CATEGORIES.includes(category ?? '') ? category : 'other',
          site_url: (site_url ?? '').trim(),
          username: (username ?? '').trim(),
          secret_encrypted: encryptSecret(secret ?? ''),
          notes_encrypted: encryptSecret(notes ?? ''),
        };
        const ownedForCreate = await ownedProjectId(projectId);
        if (ownedForCreate) row.project_id = ownedForCreate;

        const { data, error } = await admin.from('portal_credentials').insert(row).select(LIST_COLUMNS).single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await admin.from('portal_activity').insert({
          client_id: user.id,
          text: `You added secure access details: ${label.trim()}`,
          dot_color: '#1e3add',
        });

        const { data: profile } = await admin
          .from('portal_clients').select('full_name').eq('id', user.id).single();
        await notifyThrive(profile?.full_name ?? user.email ?? 'A client', user.email ?? '', label.trim(), 'added');

        return NextResponse.json({ ok: true, data: toSummary(data as CredentialRow) });
      }

      case 'update': {
        const { id, label, category, site_url, username, secret, notes, projectId } =
          body as Record<string, string | undefined>;
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
        if (!label?.trim()) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });

        const { data: existing } = await admin
          .from('portal_credentials').select('id').eq('id', id).eq('client_id', user.id).single();
        if (!existing) return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });

        const { data, error } = await admin
          .from('portal_credentials')
          .update({
            label: label.trim(),
            category: CATEGORIES.includes(category ?? '') ? category : 'other',
            site_url: (site_url ?? '').trim(),
            username: (username ?? '').trim(),
            secret_encrypted: encryptSecret(secret ?? ''),
            notes_encrypted: encryptSecret(notes ?? ''),
            project_id: await ownedProjectId(projectId),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('client_id', user.id)
          .select(LIST_COLUMNS)
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const { data: profile } = await admin
          .from('portal_clients').select('full_name').eq('id', user.id).single();
        await notifyThrive(profile?.full_name ?? user.email ?? 'A client', user.email ?? '', label.trim(), 'updated');

        return NextResponse.json({ ok: true, data: toSummary(data as CredentialRow) });
      }

      case 'delete': {
        const id = body.id as string;
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
        const { error } = await admin
          .from('portal_credentials').delete().eq('id', id).eq('client_id', user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
