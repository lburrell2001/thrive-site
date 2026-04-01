import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });

  // Verify the caller is an authenticated portal user
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const clientId = user.id;

  // Upsert client profile
  const emailName = user.email?.split('@')[0] ?? 'client';
  await admin.from('portal_clients').upsert({
    id: clientId,
    full_name: emailName,
    initials: emailName.slice(0, 2).toUpperCase(),
    company_name: '',
    role: 'client',
  }, { onConflict: 'id' });

  // Only seed if no projects exist yet (idempotent guard)
  const { data: existing } = await admin.from('portal_projects').select('id').eq('client_id', clientId).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ seeded: false, message: 'Data already exists.' });
  }

  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
  const daysAhead = (n: number) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

  // Projects
  const { data: projects } = await admin.from('portal_projects').insert([
    { client_id: clientId, name: 'Brand Identity Refresh',  status: 'in_progress', progress: 65, color: '#e40586' },
    { client_id: clientId, name: 'Instagram Content Pack',  status: 'review',      progress: 90, color: '#fd6100' },
    { client_id: clientId, name: 'Website Redesign',        status: 'kickoff',     progress: 15, color: '#1e3add' },
  ]).select('id, name');

  const projectNames = {
    brand:   projects?.[0]?.name ?? 'Brand Identity Refresh',
    social:  projects?.[1]?.name ?? 'Instagram Content Pack',
    website: projects?.[2]?.name ?? 'Website Redesign',
  };

  // Requests
  await admin.from('portal_requests').insert([
    { client_id: clientId, title: 'Social Media Content — April',     type: 'Social Media',  status: 'in_progress', priority: 'high',   created_at: new Date(today.getTime() - 3*86400000).toISOString() },
    { client_id: clientId, title: 'Logo Variations (Dark + Light)',   type: 'Brand Design',  status: 'review',      priority: 'normal', created_at: new Date(today.getTime() - 6*86400000).toISOString() },
    { client_id: clientId, title: 'Website Landing Page Copy Edit',   type: 'Digital Design',status: 'completed',   priority: 'normal', created_at: new Date(today.getTime() - 11*86400000).toISOString() },
    { client_id: clientId, title: 'Photography — Product Shoot',      type: 'Photography',   status: 'kickoff',     priority: 'high',   created_at: new Date(today.getTime() - 13*86400000).toISOString() },
    { client_id: clientId, title: 'Brand Guidelines Document',        type: 'Brand Design',  status: 'completed',   priority: 'low',    created_at: new Date(today.getTime() - 21*86400000).toISOString() },
  ]);

  // Invoices
  await admin.from('portal_invoices').insert([
    { client_id: clientId, invoice_number: '#004', project_name: projectNames.brand,   amount_cents: 80000,  invoice_date: daysAgo(3),  due_date: daysAhead(12), status: 'due' },
    { client_id: clientId, invoice_number: '#003', project_name: projectNames.social,  amount_cents: 40000,  invoice_date: daysAgo(18), due_date: daysAgo(3),   status: 'paid' },
    { client_id: clientId, invoice_number: '#002', project_name: projectNames.website, amount_cents: 120000, invoice_date: daysAgo(45), due_date: daysAgo(30),  status: 'paid' },
    { client_id: clientId, invoice_number: '#001', project_name: projectNames.brand,   amount_cents: 60000,  invoice_date: daysAgo(60), due_date: daysAgo(45),  status: 'paid' },
  ]);

  // Activity
  await admin.from('portal_activity').insert([
    { client_id: clientId, text: 'Invoice #004 sent',         dot_color: '#fd6100', created_at: new Date(today.getTime() - 2*3600000).toISOString() },
    { client_id: clientId, text: 'Brand files delivered',     dot_color: '#0cf574', created_at: new Date(today.getTime() - 24*3600000).toISOString() },
    { client_id: clientId, text: 'Revision request received', dot_color: '#e40586', created_at: new Date(today.getTime() - 2*86400000).toISOString() },
    { client_id: clientId, text: 'Contract signed',           dot_color: '#1e3add', created_at: new Date(today.getTime() - 5*86400000).toISOString() },
    { client_id: clientId, text: 'Project kickoff completed', dot_color: '#5b2d8e', created_at: new Date(today.getTime() - 7*86400000).toISOString() },
  ]);

  // Milestones
  await admin.from('portal_milestones').insert([
    { client_id: clientId, project_name: projectNames.brand,   title: 'Concept Review',        due_date: daysAhead(5),  color: '#e40586', completed: false },
    { client_id: clientId, project_name: projectNames.social,  title: 'Final Delivery',         due_date: daysAhead(8),  color: '#fd6100', completed: false },
    { client_id: clientId, project_name: projectNames.website, title: 'Wireframe Presentation', due_date: daysAhead(14), color: '#1e3add', completed: false },
  ]);

  // Onboarding steps
  await admin.from('portal_onboarding_steps').insert([
    { client_id: clientId, step_number: 1, title: 'Account Created',        description: 'Your client account is live and ready.',                    completed: true,  action_label: null,            action_href: null },
    { client_id: clientId, step_number: 2, title: 'Brand Questionnaire',    description: 'Tell us about your brand, goals, and audience.',             completed: true,  action_label: null,            action_href: null },
    { client_id: clientId, step_number: 3, title: 'Contract Signed',        description: 'Review and e-sign your project agreement.',                  completed: true,  action_label: null,            action_href: null },
    { client_id: clientId, step_number: 4, title: 'Initial Payment',        description: 'Submit your deposit to officially kick things off.',         completed: false, action_label: 'Pay Deposit',   action_href: '/portal/invoices' },
    { client_id: clientId, step_number: 5, title: 'Kickoff Call Scheduled', description: 'Book your 1:1 strategy session with our team.',              completed: false, action_label: 'Schedule Call', action_href: '/portal/dashboard' },
    { client_id: clientId, step_number: 6, title: 'Asset Upload',           description: 'Upload your existing brand files and assets.',               completed: false, action_label: 'Upload Files',  action_href: '/portal/files' },
  ]);

  return NextResponse.json({ seeded: true });
}
