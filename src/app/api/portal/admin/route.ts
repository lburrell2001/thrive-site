import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  // 1. Read Bearer token
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return err('Unauthorized', 401);

  const admin = getAdminClient();

  // 2. Verify user from token
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) return err('Unauthorized', 401);

  // 3. Check admin role
  const { data: profile } = await admin
    .from('portal_clients')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return err('Forbidden', 403);

  // 4. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400);
  }
  const { action, ...params } = body as { action: string; [key: string]: unknown };

  // 5. Dispatch actions
  try {
    switch (action) {

      case 'list_clients': {
        const { data, error } = await admin
          .from('portal_clients')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'get_client_data': {
        const clientId = params.clientId as string;
        const [profile, projects, requests, invoices, files, milestones, onboarding, activity] = await Promise.all([
          admin.from('portal_clients').select('*').eq('id', clientId).single(),
          admin.from('portal_projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
          admin.from('portal_milestones').select('*').eq('client_id', clientId).order('due_date', { ascending: true }),
          admin.from('portal_onboarding_steps').select('*').eq('client_id', clientId).order('step_number', { ascending: true }),
          admin.from('portal_activity').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
        ]);
        return NextResponse.json({
          ok: true,
          data: {
            profile: profile.data,
            projects: projects.data ?? [],
            requests: requests.data ?? [],
            invoices: invoices.data ?? [],
            files: files.data ?? [],
            milestones: milestones.data ?? [],
            onboarding: onboarding.data ?? [],
            activity: activity.data ?? [],
          },
        });
      }

      case 'update_profile': {
        const { clientId, full_name, company_name, initials } = params as Record<string, string>;
        const { error } = await admin
          .from('portal_clients')
          .update({ full_name, company_name, initials })
          .eq('id', clientId);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'create_client': {
        const { email, full_name, company_name } = params as Record<string, string>;
        const initials = (full_name ?? email)
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        if (createErr) return err(createErr.message);

        const { error: insertErr } = await admin.from('portal_clients').insert({
          id: newUser.user.id,
          full_name,
          company_name,
          initials,
          role: 'client',
        });
        if (insertErr) return err(insertErr.message);

        return NextResponse.json({ ok: true, data: { id: newUser.user.id } });
      }

      case 'add_project': {
        const { clientId, name, status, progress, color } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_projects').insert({
          client_id: clientId,
          name,
          status,
          progress: Number(progress),
          color,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_project': {
        const { id, name, status, progress } = params as Record<string, unknown>;
        const { error } = await admin
          .from('portal_projects')
          .update({ name, status, progress: Number(progress) })
          .eq('id', id);
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
        const { data, error } = await admin.from('portal_invoices').insert({
          client_id: clientId,
          invoice_number,
          project_name,
          amount_cents: Number(amount_cents),
          invoice_date,
          due_date,
          status,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'update_invoice': {
        const { id, status, invoice_number, project_name, amount_cents, due_date } = params as Record<string, unknown>;
        const { error } = await admin
          .from('portal_invoices')
          .update({ status, invoice_number, project_name, amount_cents: Number(amount_cents), due_date })
          .eq('id', id);
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
        const { data, error } = await admin.from('portal_requests').insert({
          client_id: clientId,
          title,
          type,
          status,
          priority,
        }).select().single();
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
        const { data, error } = await admin.from('portal_files').insert({
          client_id: clientId,
          name,
          project_name,
          file_url,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'delete_file': {
        const { error } = await admin.from('portal_files').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'toggle_onboarding': {
        const { id, completed } = params as { id: string; completed: boolean };
        const { error } = await admin
          .from('portal_onboarding_steps')
          .update({ completed })
          .eq('id', id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      case 'add_onboarding_step': {
        const { clientId, step_number, title, description, action_label, action_href } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_onboarding_steps').insert({
          client_id: clientId,
          step_number: Number(step_number),
          title,
          description,
          action_label: action_label || null,
          action_href: action_href || null,
          completed: false,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'add_activity': {
        const { clientId, text, dot_color } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_activity').insert({
          client_id: clientId,
          text,
          dot_color,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'add_milestone': {
        const { clientId, project_name, title, due_date, color } = params as Record<string, unknown>;
        const { data, error } = await admin.from('portal_milestones').insert({
          client_id: clientId,
          project_name,
          title,
          due_date,
          color,
          completed: false,
        }).select().single();
        if (error) return err(error.message);
        return NextResponse.json({ ok: true, data });
      }

      case 'delete_milestone': {
        const { error } = await admin.from('portal_milestones').delete().eq('id', params.id);
        if (error) return err(error.message);
        return NextResponse.json({ ok: true });
      }

      default:
        return err(`Unknown action: ${action}`, 400);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
