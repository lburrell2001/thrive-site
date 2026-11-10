export const runtime = 'nodejs';

// Work in progress (migration 052): portal projects with a checklist, a social
// media package, or a paid invoice (work under way with no estimate), with how
// far along they are. Admin Home and /admin/work.

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { hasStartingStats, type Metric } from '@/lib/projectWork';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const [tasks, accounts] = await Promise.all([
    db.from('project_tasks').select('project_id, done_at'),
    db.from('project_social_accounts').select('project_id, metrics'),
  ]);
  if (tasks.error) {
    if (/project_tasks/.test(tasks.error.message)) return NextResponse.json({ ok: true, data: { ready: false, projects: [] } });
    return badRequest(tasks.error.message);
  }
  // Open projects with a paid invoice (or a paid deposit), matched by deal or name.
  const [openProjects, paidInvoices] = await Promise.all([
    db.from('portal_projects').select('id, client_id, name, crm_deal_id, archived, completed_at'),
    db.from('portal_invoices').select('client_id, project_name, crm_deal_id, status, deposit_paid_at'),
  ]);
  const paid = (paidInvoices.data ?? []).filter((i) => i.status === 'paid' || i.deposit_paid_at);
  const paidCount = new Map<string, number>();
  for (const p of openProjects.data ?? []) {
    if (p.archived || p.completed_at) continue;
    const n = paid.filter((i) => i.client_id === p.client_id && ((p.crm_deal_id && i.crm_deal_id === p.crm_deal_id) || i.project_name?.trim().toLowerCase() === p.name.trim().toLowerCase())).length;
    if (n) paidCount.set(p.id, n);
  }
  const ids = [...new Set([...(tasks.data ?? []).map((t) => t.project_id), ...(accounts.data ?? []).map((a) => a.project_id), ...paidCount.keys()])];
  if (!ids.length) return NextResponse.json({ ok: true, data: { ready: true, projects: [] } });

  const [projects, reports] = await Promise.all([
    db.from('portal_projects').select('id, name, client_id, kind, status, progress, archived, completed_at, created_at, portal_clients ( full_name, company_name )').in('id', ids),
    db.from('project_reports').select('project_id, sent_at').in('project_id', ids),
  ]);
  const rows = (projects.data ?? []).map((p) => {
    const t = (tasks.data ?? []).filter((x) => x.project_id === p.id);
    const a = (accounts.data ?? []).filter((x) => x.project_id === p.id) as { metrics: Metric[] }[];
    const client = p.portal_clients as unknown as { full_name: string; company_name: string } | null;
    return {
      id: p.id, name: p.name, client_id: p.client_id, client: client?.company_name || client?.full_name || 'Client',
      kind: p.kind, status: p.status, progress: p.progress, archived: !!p.archived, completed_at: p.completed_at, created_at: p.created_at,
      done: t.filter((x) => x.done_at).length, total: t.length,
      social: p.kind === 'social', needs_start_stats: p.kind === 'social' && !hasStartingStats(a),
      report_sent_at: (reports.data ?? []).filter((r) => r.project_id === p.id).map((r) => r.sent_at).sort().pop() ?? null,
      paid_invoices: paidCount.get(p.id) ?? 0,
    };
  });
  rows.sort((x, y) => Number(!!x.completed_at) - Number(!!y.completed_at) || y.created_at.localeCompare(x.created_at));
  return NextResponse.json({ ok: true, data: { ready: true, projects: rows } });
}
