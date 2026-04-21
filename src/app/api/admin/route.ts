import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        const { id, name, status, progress } = params as Record<string, unknown>;
        const { error } = await admin.from('portal_projects').update({ name, status, progress: Number(progress) }).eq('id', id);
        if (error) return err(error.message);
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
        const { clientId, name, projectName, fileData, mimeType } = params as Record<string, string>;
        if (!clientId || !name || !fileData) return err('clientId, name, and fileData are required');
        const buf = Buffer.from(fileData, 'base64');
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `client-files/${clientId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await admin.storage.from('course-media').upload(path, buf, {
          contentType: mimeType ?? 'application/octet-stream',
          upsert: false,
        });
        if (uploadErr) return err(uploadErr.message);
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        const { data, error: insertErr } = await admin.from('portal_files').insert({
          client_id: clientId, name, project_name: projectName ?? '', file_url: publicUrl,
        }).select().single();
        if (insertErr) { await admin.storage.from('course-media').remove([path]); return err(insertErr.message); }
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
        return NextResponse.json({ ok: true, data });
      }

      case 'update_milestone': {
        const { id, title, due_date, completed } = params as Record<string, unknown>;
        const { error } = await admin.from('portal_milestones').update({ title, due_date, completed }).eq('id', id);
        if (error) return err(error.message);
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

      case 'upload_project_cover': {
        // body.imageData: base64 string (no data: prefix), body.slug, body.mimeType
        const { slug, imageData, mimeType } = params as Record<string, string>;
        if (!slug || !imageData) return err('slug and imageData are required');
        const buf = Buffer.from(imageData, 'base64');
        const path = `work/${slug}-cover.jpg`;
        const { error } = await admin.storage.from('course-media').upload(path, buf, {
          contentType: mimeType ?? 'image/jpeg',
          upsert: true,
        });
        if (error) return err(error.message);
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        return NextResponse.json({ ok: true, url: publicUrl });
      }

      case 'upload_gallery_image': {
        const { slug, filename, imageData, mimeType } = params as Record<string, string>;
        if (!slug || !filename || !imageData) return err('slug, filename, and imageData are required');
        const buf = Buffer.from(imageData, 'base64');
        const path = `projects/${slug}/gallery/${filename}`;
        const { error } = await admin.storage.from('course-media').upload(path, buf, {
          contentType: mimeType ?? 'image/jpeg',
          upsert: true,
        });
        if (error) return err(error.message);
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
        const { clientId, projectId, name, fileData, mimeType } = params as Record<string, string>;
        if (!clientId || !name || !fileData) return err('clientId, name, and fileData are required');
        const buf = Buffer.from(fileData, 'base64');
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `proposals/${clientId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await admin.storage.from('course-media').upload(path, buf, {
          contentType: mimeType ?? 'application/pdf',
          upsert: false,
        });
        if (uploadErr) return err(uploadErr.message);
        const { data: { publicUrl } } = admin.storage.from('course-media').getPublicUrl(path);
        const row: Record<string, unknown> = { client_id: clientId, name, file_url: publicUrl, storage_path: path, status: 'pending' };
        if (projectId) row.project_id = projectId;
        const { data, error: insertErr } = await admin.from('portal_proposals').insert(row).select().single();
        if (insertErr) { await admin.storage.from('course-media').remove([path]); return err(insertErr.message); }
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
        const { slug, imageData, mimeType } = params as Record<string, string>;
        if (!slug || !imageData) return err('slug and imageData are required');
        const buf = Buffer.from(imageData, 'base64');
        const path = `services/${slug}-cover.jpg`;
        const { error } = await admin.storage.from('course-media').upload(path, buf, {
          contentType: mimeType ?? 'image/jpeg',
          upsert: true,
        });
        if (error) return err(error.message);
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
