export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { estimateRow, estimateSchema, missingEstimatesTable, missingTotalsOnly, nextEstimateNumber, withoutTotalsOnly } from '@/lib/estimates';

const INVOICE_COLUMNS = 'id, client_id, invoice_number, project_name, amount_cents, invoice_date, due_date, status';

/** Everything the builder needs: estimates, recent invoices, and who to bill. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const [estimates, clients, contacts] = await Promise.all([
    db.from('estimates').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('portal_clients').select('id, full_name, company_name').eq('role', 'client').order('company_name'),
    db.from('crm_contacts').select('id, name, company, email, portal_client_id').order('name').limit(2000),
  ]);

  // Lines and notes only exist once 039 is in.
  const recent = (columns: string) => db.from('portal_invoices').select(columns).order('created_at', { ascending: false }).limit(30);
  let invoices = await recent(`${INVOICE_COLUMNS}, line_items, notes, totals_only, deposit_cents, deposit_due_date, deposit_paid_at, balance_open`);
  if (invoices.error) invoices = await recent(`${INVOICE_COLUMNS}, line_items, notes, totals_only`);
  if (invoices.error) invoices = await recent(`${INVOICE_COLUMNS}, line_items, notes`);
  if (invoices.error) invoices = await recent(INVOICE_COLUMNS);

  // Each portal client's projects, for the Project dropdown.
  const projectQuery = (columns: string) => db.from('portal_projects').select(columns).order('created_at', { ascending: false });
  let projects = await projectQuery('id, client_id, name, status, archived');
  if (projects.error) projects = await projectQuery('id, client_id, name, status');

  // Open deals too (a deal made before deal projects has no portal project).
  const dealQuery = (closed: boolean) => {
    const q = db.from('crm_deals').select('id, contact_id, title, stage').neq('stage', 'lost').order('updated_at', { ascending: false }).limit(2000);
    return closed ? q.is('closed_at', null) : q;
  };
  let deals = await dealQuery(true);
  if (deals.error) deals = await dealQuery(false);

  return NextResponse.json({
    ok: true,
    data: {
      projects: projects.data ?? [],
      deals: deals.data ?? [],
      ready: !estimates.error,
      estimates: estimates.data ?? [],
      invoices: invoices.data ?? [],
      clients: clients.data ?? [],
      contacts: contacts.data ?? [],
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = estimateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid estimate');

  // The unique number is the guard if two saves race; try once more.
  let row = estimateRow(parsed.data);
  for (let attempt = 0; attempt < 3; attempt++) {
    const estimate_number = await nextEstimateNumber(auth.db);
    const { data, error } = await auth.db
      .from('estimates')
      .insert({ ...row, estimate_number })
      .select('*')
      .single();
    if (!error) return NextResponse.json({ ok: true, data });
    if (missingTotalsOnly(error.message) && 'totals_only' in row) { row = withoutTotalsOnly(row); continue; }
    if (missingEstimatesTable(error.message)) return badRequest('Run migration 039 in Supabase to save estimates.', 503);
    if (error.code !== '23505') return badRequest(error.message);
  }
  return badRequest('Could not number the estimate. Try again.');
}
