import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const PORTAL_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thrivecreativestudios.org'}/portal/dashboard`;

function escHtml(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function notifyClient(
  admin: ReturnType<typeof getAdmin>,
  clientId: string,
  subject: string,
  headline: string,
  detail: string,
) {
  const resendKey  = process.env.RESEND_API_KEY;
  const notifyFrom = process.env.CONTACT_NOTIFY_FROM;
  if (!resendKey || !notifyFrom) return;
  try {
    const [authRes, profileRes] = await Promise.all([
      admin.auth.admin.getUserById(clientId),
      admin.from('portal_clients').select('full_name').eq('id', clientId).single(),
    ]);
    const clientEmail = authRes.data.user?.email;
    if (!clientEmail) return;
    const firstName = (profileRes.data?.full_name ?? '').split(' ')[0] || 'there';

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: notifyFrom,
      to: clientEmail,
      subject,
      text: `Hi ${firstName},\n\n${headline}\n\n${detail}\n\nLog in to your portal:\n${PORTAL_URL}`,
      html: `
        <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:28px;">
            <div style="background:linear-gradient(135deg,#ff2ea6,#7c3aed,#22d3ee);padding:2px;border-radius:18px;">
              <div style="background:#0b0b0f;border-radius:16px;padding:20px 22px 16px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:12px;height:12px;border-radius:999px;background:#ff2ea6;box-shadow:0 0 0 4px rgba(255,46,166,.18);"></div>
                  <div style="color:#fff;font-weight:900;font-size:15px;">Thrive Creative Studios</div>
                </div>
                <div style="margin-top:6px;color:#d7d7e0;font-size:13px;">Your client portal has been updated.</div>
              </div>
            </div>
            <div style="margin-top:16px;background:#11111a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;">
              <div style="color:#fff;font-size:17px;font-weight:900;margin-bottom:6px;">Hi ${escHtml(firstName)},</div>
              <div style="color:#d7d7e0;font-size:14px;line-height:1.6;margin-bottom:8px;">${escHtml(headline)}</div>
              ${detail ? `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px 16px;color:#fff;font-size:13px;line-height:1.6;margin-bottom:16px;">${escHtml(detail)}</div>` : ''}
              <a href="${PORTAL_URL}" style="display:inline-block;background:#ff2ea6;color:#0b0b0f;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;">View Portal →</a>
            </div>
            <div style="margin-top:14px;color:#6c7386;font-size:12px;text-align:center;">
              Thrive Creative Studios · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Client notification failed:', e);
  }
}

async function logActivity(
  admin: ReturnType<typeof getAdmin>,
  clientId: string,
  text: string,
  dotColor: string,
  projectName?: string | null,
) {
  const row: Record<string, unknown> = { client_id: clientId, text, dot_color: dotColor };
  if (projectName) row.project_name = projectName;
  await admin.from('portal_activity').insert(row);
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function verifyPasscode(admin: ReturnType<typeof getAdmin>, passcode: string): Promise<boolean> {
  const { data } = await admin.from('admin_config').select('value').eq('key', 'passcode').single();
  return !!data && data.value === passcode;
}

export async function POST(req: NextRequest) {
  let admin: ReturnType<typeof getAdmin>;
  try { admin = getAdmin(); } catch { return err('Server misconfiguration', 500); }

  const passcode = req.headers.get('X-Admin-Passcode') ?? '';
  if (!passcode) return err('Unauthorized', 401);

  const valid = await verifyPasscode(admin, passcode);
  if (!valid) return err('Incorrect passcode', 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err('Invalid JSON'); }

  const { action, ...params } = body as { action: string; [key: string]: unknown };

  try {
    switch (action) {

      case 'verify':
        return NextResponse.json({ ok: true });

      case 'change_passcode': {
        const { new_passcode } = params as Record<string, string>;
        if (!new_passcode || new_passcode.length < 4) return err('Passcode must be at least 4 characters');
        const { error } = await admin.from('admin_config').update({ value: new_passcode, updated_at: new Date().toISOString() }).eq('key', 'passcode');
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'list_clients': {
        const { data, error } = await admin.from('portal_clients').select('*').order('created_at', { ascending: false });
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'get_client_data': {
        const clientId = params.clientId as string;
        const [authUser, profile, projects, requests, invoices, files, milestones, onboarding, activity, proposals] = await Promise.all([
          admin.auth.admin.getUserById(clientId),
          admin.from('portal_clients').select('*').eq('id', clientId).single(),
          admin.from('portal_projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_milestones').select('*').eq('client_id', clientId).order('due_date', { ascending: true }),
          admin.from('portal_onboarding_steps').select('*').eq('client_id', clientId).order('step_number', { ascending: true }),
          admin.from('portal_activity').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
          admin.from('portal_proposals').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        ]);
        return NextResponse.json({
          ok: true,
          data: {
            profile: profile.data ? { ...profile.data, email: authUser.data.user?.email ?? null } : null,
            projects: projects.data ?? [],
            requests: requests.data ?? [],
            invoices: invoices.data ?? [],
            files: files.data ?? [],
            milestones: milestones.data ?? [],
            onboarding: onboarding.data ?? [],
            activity: activity.data ?? [],
            proposals: proposals.data ?? [],
          },
        });
      }

      case 'remove_demo_data': {
        const { clientId } = params as { clientId: string };
        if (!clientId) return err('clientId is required');
        // Server-side guard: only allow for the demo account
        const { data: authData } = await admin.auth.admin.getUserById(clientId);
        if (authData.user?.email !== 'lauren@thrivecreativestudios.org') {
          return err('Not authorized', 403);
        }
        await Promise.all([
          admin.from('portal_projects').delete().eq('client_id', clientId),
          admin.from('portal_invoices').delete().eq('client_id', clientId),
          admin.from('portal_requests').delete().eq('client_id', clientId),
          admin.from('portal_files').delete().eq('client_id', clientId),
          admin.from('portal_milestones').delete().eq('client_id', clientId),
          admin.from('portal_onboarding_steps').delete().eq('client_id', clientId),
          admin.from('portal_activity').delete().eq('client_id', clientId),
        ]);
        return NextResponse.json({ ok: true });
      }

      case 'update_profile': {
        const { clientId, full_name, company_name, initials, email } = params as Record<string, string>;
        if (email) {
          const { error: emailErr } = await admin.auth.admin.updateUserById(clientId, { email });
          if (emailErr) return err(emailErr.message);
        }
        const { error } = await admin.from('portal_clients').update({ full_name, company_name, initials }).eq('id', clientId);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'create_client': {
        const { email, full_name, company_name } = params as Record<string, string>;
        const initials = (full_name ?? email).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
        if (createErr) return err(createErr.message);
        const { error: insertErr } = await admin.from('portal_clients').insert({ id: newUser.user.id, full_name, company_name, initials, role: 'client' });
        if (insertErr) return err(insertErr.message);
        return NextResponse.json({ ok: true, data: { id: newUser.user.id } });
      }

      case 'delete_client': {
        const { clientId } = params as Record<string, string>;
        await admin.from('portal_clients').delete().eq('id', clientId);
        const { error } = await admin.auth.admin.deleteUser(clientId);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_project': {
        const { clientId, name, status, progress, color } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_projects').insert({ client_id: clientId, name, status, progress: Number(progress), color }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_project': {
        const { id, name, status, progress, stages } = params as Record<string, unknown>;
        const { data: prev } = await admin.from('portal_projects').select('client_id, status, progress, color').eq('id', id).single();
        const updates: Record<string, unknown> = { name, status, progress: Number(progress) };
        if (stages !== undefined) updates.stages = stages;
        const { error } = await admin.from('portal_projects').update(updates).eq('id', id);
        if (error) return err(error.message);
        if (prev) {
          const statusChanged = prev.status !== status;
          const progressChanged = prev.progress !== Number(progress);
          if (statusChanged || progressChanged) {
            const label = statusChanged
              ? `Project "${name}" moved to ${String(status).replace('_', ' ')}`
              : `Project "${name}" progress updated to ${progress}%`;
            logActivity(admin, prev.client_id, label, prev.color ?? '#808080', String(name));
          }
        }
        return NextResponse.json({ ok: true });
      }

      case 'delete_project': {
        const { error } = await admin.from('portal_projects').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_invoice': {
        const { clientId, invoice_number, project_name, amount_cents, invoice_date, due_date, status } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_invoices').insert({ client_id: clientId, invoice_number, project_name, amount_cents: Number(amount_cents), invoice_date, due_date, status }).select().single();
        if (error) return err(error.message);
        const fmtAmt = ((Number(amount_cents)) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
        logActivity(admin, clientId as string, `Invoice ${invoice_number} sent — ${fmtAmt} due`, '#1e3add', project_name as string | null);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_invoice': {
        const { id, status, invoice_number, project_name, amount_cents, due_date } = params as Record<string, unknown>;
        const { error } = await admin.from('portal_invoices').update({ status, invoice_number, project_name, amount_cents: Number(amount_cents), due_date }).eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'delete_invoice': {
        const { error } = await admin.from('portal_invoices').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_request': {
        const { clientId, title, type, status, priority } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_requests').insert({ client_id: clientId, title, type, status, priority }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'delete_request': {
        const { error } = await admin.from('portal_requests').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_file': {
        const { clientId, name, project_name, file_url } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_files').insert({ client_id: clientId, name, project_name, file_url }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'upload_file': {
        const { clientId, name, projectName, path } = params as Record<string, string>;
        if (!clientId || !name || !path) return err('clientId, name, and path are required');
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        const { data, error: insertErr } = await admin.from('portal_files').insert({
          client_id: clientId, name, project_name: projectName ?? '', file_url: publicUrl,
        }).select().single();
        if (insertErr) return err(insertErr.message);
        logActivity(admin, clientId, `New file delivered: ${name}`, '#fd6100', projectName || null);
        notifyClient(
          admin, clientId,
          'A new file has been delivered to your portal',
          `A new file is ready for you: ${name}`,
          projectName ? `Project: ${projectName}` : '',
        );
        return NextResponse.json({ ok: true, data });
      }

      case 'delete_file': {
        const { error } = await admin.from('portal_files').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_milestone': {
        const { clientId, project_name, title, due_date, color } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_milestones').insert({ client_id: clientId, project_name, title, due_date, color, completed: false }).select().single();
        if (error) return err(error.message);
        logActivity(admin, clientId as string, `New milestone added: ${title}`, color as string, project_name as string | null);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_milestone': {
        const { id, title, due_date, completed } = params as Record<string, unknown>;
        const { error } = await admin.from('portal_milestones').update({ title, due_date, completed }).eq('id', id);
        if (error) return err(error.message);
        if (completed) {
          const { data: ms } = await admin.from('portal_milestones').select('client_id, project_name').eq('id', id).single();
          if (ms) logActivity(admin, ms.client_id, `Milestone completed: ${title}`, '#0cf574', ms.project_name ?? null);
        }
        return NextResponse.json({ ok: true });
      }

      case 'delete_milestone': {
        const { error } = await admin.from('portal_milestones').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'toggle_onboarding': {
        const { id, completed } = params as { id: string; completed: boolean };
        const { error } = await admin.from('portal_onboarding_steps').update({ completed }).eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_onboarding_step': {
        const { clientId, step_number, title, description, action_label, action_href } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_onboarding_steps').insert({ client_id: clientId, step_number: Number(step_number), title, description, action_label: action_label || null, action_href: action_href || null, completed: false }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'add_activity': {
        const { clientId, text, dot_color, project_name } = params as Record<string, unknown>;
        const row: Record<string, unknown> = { client_id: clientId, text, dot_color };
        if (project_name) row.project_name = project_name;
        const { data, error } = await admin.from('portal_activity').insert(row).select().single();
        if (error) return err(error.message);
        notifyClient(
          admin, clientId as string,
          'New update in your Thrive portal',
          String(text),
          project_name ? `Project: ${project_name}` : '',
        );
        return NextResponse.json({ ok: true, data });
      }

      // ── Portfolio (public case study) management ───────────────────────────

      case 'list_portfolio_projects': {
        const { data, error } = await admin.from('projects').select('*').order('title', { ascending: true });
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'create_portfolio_project': {
        const { title, slug, category, category_label, year, tagline, overview, role,
                tools, problem, solution, results,
                project_notes, featured } = params as Record<string, unknown>;
        if (!title || !slug) return err('title and slug are required');
        const insertPayload: Record<string, unknown> = {
          title, slug, category, year, tagline, overview, role,
          tools: tools ?? [], problem, solution, results,
          project_notes, featured: featured ?? false, span: '1', order_index: 0,
        };
        if (category_label !== undefined && category_label !== null) insertPayload.category_label = category_label;
        const { data, error } = await admin.from('projects').insert(insertPayload).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_portfolio_project': {
        const { id, title, slug, category, category_label, year, tagline, overview, role,
                tools, problem, solution, results,
                project_notes, featured } = params as Record<string, unknown>;
        if (!id) return err('id is required');
        const updatePayload: Record<string, unknown> = {
          title, slug, category, year, tagline, overview, role,
          tools: tools ?? [], problem, solution, results,
          project_notes, featured: featured ?? false,
        };
        if (category_label !== undefined && category_label !== null) updatePayload.category_label = category_label;
        const { error } = await admin.from('projects').update(updatePayload).eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'list_service_featured': {
        const { serviceSlug } = params as { serviceSlug: string };
        if (!serviceSlug) return err('serviceSlug is required');
        const { data, error } = await admin
          .from('service_featured_projects')
          .select('project_slug, display_order')
          .eq('service_slug', serviceSlug)
          .order('display_order', { ascending: true });
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data: data ?? [] });
      }

      case 'set_service_featured': {
        const { serviceSlug, projectSlugs } = params as { serviceSlug: string; projectSlugs: string[] };
        if (!serviceSlug) return err('serviceSlug is required');
        const { error: delError } = await admin
          .from('service_featured_projects')
          .delete()
          .eq('service_slug', serviceSlug);
        if (delError) return err(delError.message);
        if (projectSlugs && projectSlugs.length > 0) {
          const rows = projectSlugs.map((slug, i) => ({
            service_slug: serviceSlug,
            project_slug: slug,
            display_order: i,
          }));
          const { error: insError } = await admin
            .from('service_featured_projects')
            .insert(rows);
          if (insError) return err(insError.message);
        }
        return NextResponse.json({ ok: true });
      }

      case 'delete_portfolio_project': {
        const { id } = params as { id: string };
        if (!id) return err('id is required');
        const { error } = await admin.from('projects').delete().eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'create_upload_url': {
        const { path, upsert } = params as { path: string; upsert?: boolean };
        if (!path) return err('path is required');
        const { data, error } = await admin.storage
          .from('course-media')
          .createSignedUploadUrl(path, { upsert: upsert ?? false });
        if (error) return err(error.message);
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        return NextResponse.json({ ok: true, signedUrl: data.signedUrl, path: data.path, publicUrl });
      }

      case 'upload_project_cover': {
        const { slug, path } = params as Record<string, string>;
        if (!slug || !path) return err('slug and path are required');
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        return NextResponse.json({ ok: true, url: publicUrl });
      }

      case 'upload_gallery_image': {
        const { slug, filename, path } = params as Record<string, string>;
        if (!slug || !filename || !path) return err('slug, filename, and path are required');
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        return NextResponse.json({ ok: true, url: publicUrl });
      }

      case 'list_gallery_images': {
        const { slug } = params as { slug: string };
        if (!slug) return err('slug is required');
        const { data, error } = await admin.storage.from('course-media').list(`projects/${slug}/gallery`, { limit: 100 });
        if (error) return err(error.message);
        const images = (data ?? [])
          .filter((f) => f.name && !f.name.startsWith('.'))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((f) => ({
            name: f.name,
            url: admin.storage.from('course-media').getPublicUrl(`projects/${slug}/gallery/${f.name}`).data.publicUrl,
          }));
        return NextResponse.json({ ok: true, data: images });
      }

      case 'upload_proposal': {
        const { clientId, projectId, name, path } = params as Record<string, string>;
        if (!clientId || !name || !path) return err('clientId, name, and path are required');
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        const row: Record<string, unknown> = { client_id: clientId, name, file_url: publicUrl, storage_path: path, status: 'pending' };
        if (projectId) row.project_id = projectId;
        const { data, error: insertErr } = await admin.from('portal_proposals').insert(row).select().single();
        if (insertErr) return err(insertErr.message);
        logActivity(admin, clientId, `Proposal ready for review: ${name}`, '#e40586', null);
        notifyClient(
          admin, clientId,
          'A proposal is ready for your review',
          `A proposal has been uploaded for you to review and sign: ${name}`,
          'Log in to your portal to download, sign, and return it.',
        );
        return NextResponse.json({ ok: true, data });
      }

      case 'delete_proposal': {
        const { id } = params as { id: string };
        if (!id) return err('id is required');
        const { data: row } = await admin.from('portal_proposals').select('storage_path').eq('id', id).single();
        if (row?.storage_path) await admin.storage.from('course-media').remove([row.storage_path]);
        const { error } = await admin.from('portal_proposals').delete().eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'set_proposal_status': {
        const { id, status } = params as { id: string; status: string };
        if (!id || !status) return err('id and status are required');
        const { error } = await admin.from('portal_proposals').update({ status }).eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'delete_gallery_image': {
        const { slug, filename } = params as Record<string, string>;
        if (!slug || !filename) return err('slug and filename are required');
        const { error } = await admin.storage.from('course-media').remove([`projects/${slug}/gallery/${filename}`]);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'upload_service_cover': {
        const { slug, path } = params as Record<string, string>;
        if (!slug || !path) return err('slug and path are required');
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        return NextResponse.json({ ok: true, url: publicUrl });
      }

      default:
        return err(`Unknown action: ${action}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
