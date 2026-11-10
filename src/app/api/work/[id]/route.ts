export const runtime = 'nodejs';

// One project's work (migration 052): checklist, social accounts and stats,
// what was invoiced and paid, and the completion report.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { DEFAULT_METRICS, projectChecklistFromEstimate, projectChecklistFromInvoice, projectInvoices, syncProjectProgress, taskTitle } from '@/lib/projectWork';
import type { LineItem } from '@/lib/lineItems';
import { remainingCents } from '@/lib/invoiceDeposit';
import { sendCompletionReport } from '@/lib/completionReport';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const { data: project } = await db.from('portal_projects').select('*').eq('id', id).maybeSingle();
  if (!project) return badRequest('Project not found', 404);
  const [client, tasks, accounts, reports, invoices, estimates, deal, user] = await Promise.all([
    db.from('portal_clients').select('id, full_name, company_name').eq('id', project.client_id).maybeSingle(),
    db.from('project_tasks').select('*').eq('project_id', id).order('position'),
    db.from('project_social_accounts').select('*').eq('project_id', id).order('position'),
    db.from('project_reports').select('id, sent_at, sent_to, data').eq('project_id', id).order('sent_at', { ascending: false }),
    projectInvoices(db, project),
    db.from('estimates').select('id, estimate_number, title, total_cents, status, accepted_at, line_items').eq('portal_client_id', project.client_id).order('created_at', { ascending: false }),
    project.crm_deal_id ? db.from('crm_deals').select('id, title, stage, closed_at, monthly_cents').eq('id', project.crm_deal_id).maybeSingle() : Promise.resolve({ data: null }),
    db.auth.admin.getUserById(project.client_id),
  ]);
  const taskEstimateIds = new Set((tasks.data ?? []).map((t) => t.estimate_id).filter(Boolean));
  const started = (estimates.data ?? []).filter((e) => taskEstimateIds.has(e.id)).map((e) => e.accepted_at).filter(Boolean).sort()[0] ?? project.created_at;

  return NextResponse.json({
    ok: true,
    data: {
      project,
      client: { ...(client.data ?? {}), email: user.data.user?.email ?? null },
      tasks: tasks.data ?? [],
      accounts: accounts.data ?? [],
      reports: (reports.data ?? []).map(({ data, ...r }) => ({ ...r, invoice_id: (data as { invoice_id?: string } | null)?.invoice_id ?? null })),
      invoices: invoices.map((inv) => {
        const lines = (Array.isArray(inv.line_items) ? inv.line_items as LineItem[] : []).filter((l) => l.amount_cents >= 0);
        return {
          id: inv.id, invoice_number: inv.invoice_number, amount_cents: inv.amount_cents, status: inv.status,
          paid_cents: inv.amount_cents - remainingCents(inv), lines: lines.length, project_name: inv.project_name,
          invoice_date: inv.invoice_date,
          // What the report for this invoice lists. Older invoices have no lines: the project name is the one item.
          items: lines.length ? lines.map((l) => taskTitle(l.name)) : [taskTitle(inv.project_name || 'Project work')],
        };
      }),
      estimates: (estimates.data ?? []).map(({ line_items, ...e }) => ({ ...e, lines: Array.isArray(line_items) ? line_items.length : 0 })),
      deal: deal.data,
      started_at: started,
    },
  });
}

const metric = z.object({ key: z.string().max(60), label: z.string().trim().min(1).max(80), unit: z.enum(['', '%']).optional(), start: z.number().nullable(), end: z.number().nullable() });
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_task'), title: z.string().trim().min(1).max(200), description: z.string().max(2000).default('') }),
  z.object({ action: z.literal('update_task'), task_id: z.string().uuid(), title: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).optional(), done: z.boolean().optional() }),
  z.object({ action: z.literal('delete_task'), task_id: z.string().uuid() }),
  z.object({ action: z.literal('reorder_tasks'), ids: z.array(z.string().uuid()).max(500) }),
  z.object({ action: z.literal('from_estimate'), estimate_id: z.string().uuid() }),
  z.object({ action: z.literal('from_invoice'), invoice_id: z.string().uuid() }),
  z.object({ action: z.literal('set_social'), social: z.boolean() }),
  z.object({ action: z.literal('add_account') }),
  z.object({
    action: z.literal('save_account'), account_id: z.string().uuid(), platform: z.string().max(40), handle: z.string().max(120),
    metrics: z.array(metric).max(30), start_captured_on: z.string().nullable(), end_captured_on: z.string().nullable(),
  }),
  z.object({ action: z.literal('delete_account'), account_id: z.string().uuid() }),
  z.object({
    action: z.literal('send_report'), email: z.string().trim().email('Enter their email'), note: z.string().max(4000).optional(),
    pdf: z.string().min(100).max(4_000_000), data: z.record(z.string(), z.unknown()), close_deal: z.boolean().default(true),
    invoice_id: z.string().uuid().nullable().default(null),
  }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const body = parsed.data;
  const { data: project } = await db.from('portal_projects').select('id, name, client_id, crm_deal_id').eq('id', id).maybeSingle();
  if (!project) return badRequest('Project not found', 404);
  const ok = (data: unknown = null) => NextResponse.json({ ok: true, data });

  switch (body.action) {
    case 'add_task': {
      const { data: last } = await db.from('project_tasks').select('position').eq('project_id', id).order('position', { ascending: false }).limit(1).maybeSingle();
      const { error } = await db.from('project_tasks').insert({ project_id: id, title: body.title, description: body.description, position: (last?.position ?? -1) + 1 });
      if (error) return badRequest(/project_tasks/.test(error.message) ? 'Run migration 052 in Supabase first.' : error.message);
      return ok({ progress: await syncProjectProgress(db, id) });
    }
    case 'update_task': {
      const patch: Record<string, unknown> = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.description !== undefined) patch.description = body.description;
      if (body.done !== undefined) patch.done_at = body.done ? new Date().toISOString() : null;
      const { error } = await db.from('project_tasks').update(patch).eq('id', body.task_id).eq('project_id', id);
      if (error) return badRequest(error.message);
      return ok({ progress: await syncProjectProgress(db, id) });
    }
    case 'delete_task': {
      const { error } = await db.from('project_tasks').delete().eq('id', body.task_id).eq('project_id', id);
      if (error) return badRequest(error.message);
      return ok({ progress: await syncProjectProgress(db, id) });
    }
    case 'reorder_tasks': {
      await Promise.all(body.ids.map((tid, i) => db.from('project_tasks').update({ position: i }).eq('id', tid).eq('project_id', id)));
      return ok();
    }
    case 'from_estimate': {
      await projectChecklistFromEstimate(db, body.estimate_id, id);
      return ok({ progress: await syncProjectProgress(db, id) });
    }
    case 'from_invoice': {
      const { data: inv } = await db.from('portal_invoices').select('client_id').eq('id', body.invoice_id).maybeSingle();
      if (!inv || inv.client_id !== project.client_id) return badRequest('That invoice isn’t this client’s');
      await projectChecklistFromInvoice(db, body.invoice_id, { projectId: id, onlyIfEmpty: false });
      return ok({ progress: await syncProjectProgress(db, id) });
    }
    case 'set_social': {
      await db.from('portal_projects').update({ kind: body.social ? 'social' : null }).eq('id', id);
      if (body.social) {
        const { count } = await db.from('project_social_accounts').select('id', { count: 'exact', head: true }).eq('project_id', id);
        if (!count) await db.from('project_social_accounts').insert({ project_id: id, metrics: DEFAULT_METRICS, position: 0 });
      }
      return ok();
    }
    case 'add_account': {
      const { count } = await db.from('project_social_accounts').select('id', { count: 'exact', head: true }).eq('project_id', id);
      const { error } = await db.from('project_social_accounts').insert({ project_id: id, metrics: DEFAULT_METRICS, position: count ?? 0 });
      if (error) return badRequest(error.message);
      return ok();
    }
    case 'save_account': {
      const { error } = await db.from('project_social_accounts').update({
        platform: body.platform, handle: body.handle.replace(/^@/, ''), metrics: body.metrics,
        start_captured_on: body.start_captured_on || null, end_captured_on: body.end_captured_on || null,
      }).eq('id', body.account_id).eq('project_id', id);
      if (error) return badRequest(error.message);
      return ok();
    }
    case 'delete_account': {
      await db.from('project_social_accounts').delete().eq('id', body.account_id).eq('project_id', id);
      return ok();
    }
    case 'send_report': {
      const sent = await sendCompletionReport(db, id, { email: body.email, note: body.note, pdf: body.pdf, data: body.data, closeDeal: body.close_deal, invoiceId: body.invoice_id });
      if (!sent.ok) return badRequest(sent.error);
      return ok({ to: body.email, completed: sent.completed });
    }
  }
}
