'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbProject  { id: string; name: string; status: string; progress: number; color: string; }
interface DbActivity { id: string; text: string; dot_color: string; created_at: string; }
interface DbMilestone { id: string; project_name: string; title: string; due_date: string; color: string; }

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress', review: 'Review', kickoff: 'Kickoff', completed: 'Completed',
};
const STATUS_COLOR: Record<string, string> = {
  in_progress: '#e40586', review: '#fd6100', kickoff: '#1e3add', completed: '#0cf574',
};

function relativeTime(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Skeleton({ w = '100%', h = 18, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef', flexShrink: 0 }} />
  );
}

function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 10, textAlign: 'center' }}>
      <div style={{ color: '#d0d0d0' }}>{icon}</div>
      <p style={{ fontFamily: F.inter, fontSize: 13, color: '#bfbfbf', margin: 0 }}>{message}</p>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const [loading,    setLoading]    = useState(true);
  const [projects,   setProjects]   = useState<DbProject[] | null>(null);
  const [activity,   setActivity]   = useState<DbActivity[] | null>(null);
  const [milestones, setMilestones] = useState<DbMilestone[] | null>(null);
  const [stats, setStats] = useState<{
    activeProjects: number | null;
    pendingRequests: number | null;
    invoicesDue: string | null;
    filesDelivered: number | null;
  }>({ activeProjects: null, pendingRequests: null, invoicesDue: null, filesDelivered: null });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;

      const [pR, aR, mR, rR, iR, fR] = await Promise.all([
        supabasePortal.from('portal_projects').select('*').eq('client_id', user.id).neq('status', 'completed'),
        supabasePortal.from('portal_activity').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(6),
        supabasePortal.from('portal_milestones').select('*').eq('client_id', user.id).eq('completed', false).order('due_date', { ascending: true }).limit(5),
        supabasePortal.from('portal_requests').select('id,status').eq('client_id', user.id),
        supabasePortal.from('portal_invoices').select('amount_cents,status').eq('client_id', user.id),
        supabasePortal.from('portal_files').select('id').eq('client_id', user.id),
      ]);

      setProjects(pR.data ?? []);
      setActivity(aR.data ?? []);
      setMilestones(mR.data ?? []);

      const dbR = rR.data ?? [];
      const dbI = iR.data ?? [];
      const dbF = fR.data ?? [];

      const pending = dbR.filter((r: { status: string }) =>
        ['kickoff', 'in_progress', 'review'].includes(r.status)
      ).length;

      const dueCents = dbI
        .filter((i: { status: string }) => i.status === 'due' || i.status === 'overdue')
        .reduce((s: number, i: { amount_cents: number }) => s + i.amount_cents, 0);

      setStats({
        activeProjects:  pR.error  ? null : (pR.data ?? []).length,
        pendingRequests: rR.error  ? null : pending,
        invoicesDue:     iR.error  ? null : (dueCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }),
        filesDelivered:  fR.error  ? null : dbF.length,
      });

      setLoading(false);
    }
    load();
  }, []);

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden',
  };
  const sectionTitle: React.CSSProperties = {
    fontFamily: F.bungee, fontSize: 13, color: '#0a0a0a', letterSpacing: '-0.01em', margin: 0,
  };
  const divider: React.CSSProperties = { height: 1, background: '#f1f0ef', margin: '0 24px' };

  const statCards = [
    { label: 'Active Projects',  value: stats.activeProjects,  color: '#e40586', fmt: (v: number) => String(v) },
    { label: 'Pending Requests', value: stats.pendingRequests, color: '#fd6100', fmt: (v: number) => String(v) },
    { label: 'Invoices Due',     value: stats.invoicesDue,     color: '#1e3add', fmt: (v: string) => v },
    { label: 'Files Delivered',  value: stats.filesDelivered,  color: '#0cf574', fmt: (v: number) => String(v) },
  ];

  const QUICK_ACTIONS = [
    { label: 'Submit Request', href: '/portal/requests',   bg: '#e40586', color: '#fff' },
    { label: 'Upload Files',   href: '/portal/files',      bg: '#fd6100', color: '#fff' },
    { label: 'Pay Invoice',    href: '/portal/invoices',   bg: '#0cf574', color: '#0a0a0a' },
    { label: 'View Contract',  href: '/portal/onboarding', bg: '#1e3add', color: '#fff' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, background: '#f6f5f4', minHeight: '100%' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .skel { animation: pulse 1.5s ease-in-out infinite; }
        .dash-stats   { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
        .dash-mid     { display: flex; flex-direction: column; gap: 16px; }
        .dash-projects { min-height: 280px; }
        .dash-activity { min-height: 280px; }
        @media (min-width: 1200px) {
          .dash-stats { grid-template-columns: repeat(4,1fr); }
          .dash-mid   { flex-direction: row; }
          .dash-projects { flex: 0 0 auto; width: 58%; }
          .dash-activity { flex: 1; }
        }
      `}</style>

      {/* ── Stat cards ── */}
      <div className="dash-stats">
        {statCards.map((c) => (
          <div key={c.label} style={card}>
            <div style={{ height: 4, background: c.color }} />
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#808080', margin: 0 }}>
                {c.label}
              </p>
              {loading ? (
                <div style={{ marginTop: 12 }}><Skeleton h={32} w="60%" r={6} /></div>
              ) : c.value === null ? (
                <p style={{ fontFamily: F.bungee, fontSize: 32, color: '#d0d0d0', margin: '8px 0 0' }}>—</p>
              ) : (
                <p style={{ fontFamily: F.bungee, fontSize: 32, color: '#0a0a0a', margin: '8px 0 0' }}>
                  {c.fmt(c.value as never)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Projects + Activity ── */}
      <div className="dash-mid">

        {/* Active Projects */}
        <div className="dash-projects" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' }}>
            <h2 style={sectionTitle}>ACTIVE PROJECTS</h2>
            <Link href="/portal/requests" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#0a0a0a', background: '#f0fff8', border: '1px solid #0cf574', borderRadius: 999, padding: '4px 12px', textDecoration: 'none' }}>
              + New Request
            </Link>
          </div>
          <div style={divider} />

          {loading ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Skeleton w="45%" h={14} />
                    <Skeleton w="18%" h={14} />
                  </div>
                  <Skeleton h={8} r={999} />
                  <Skeleton w="20%" h={11} />
                </div>
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {projects.map((p) => {
                const color = (p.color || STATUS_COLOR[p.status]) ?? '#808080';
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a' }}>{p.name}</span>
                      <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status] ?? '#808080', background: `${STATUS_COLOR[p.status] ?? '#808080'}18`, padding: '2px 8px', borderRadius: 999 }}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${p.progress}%`, transition: 'width .4s ease' }} />
                    </div>
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginTop: 4, display: 'block' }}>{p.progress}% complete</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="24" height="20" rx="3" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M4 12h24" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M11 19h10M11 23h6" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              message="No active projects yet"
              action={<Link href="/portal/requests" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#e40586', textDecoration: 'none', border: '1px solid #e40586', borderRadius: 999, padding: '5px 14px' }}>+ New Request</Link>}
            />
          )}
        </div>

        {/* Recent Activity */}
        <div className="dash-activity" style={card}>
          <div style={{ padding: '20px 24px 16px' }}>
            <h2 style={sectionTitle}>RECENT ACTIVITY</h2>
          </div>
          <div style={divider} />

          {loading ? (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Skeleton w={8} h={8} r={999} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Skeleton w="80%" h={13} />
                    <Skeleton w="30%" h={11} />
                  </div>
                </div>
              ))}
            </div>
          ) : activity && activity.length > 0 ? (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activity.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot_color, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <span style={{ fontFamily: F.inter, fontSize: 14, color: '#0a0a0a', display: 'block' }}>{item.text}</span>
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf' }}>{relativeTime(item.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M16 10v6l4 2" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              message="No recent activity"
            />
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ ...card, padding: '20px 24px' }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>QUICK ACTIONS</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} href={a.href} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, background: a.bg, color: a.color, padding: '12px 20px', borderRadius: 10, textDecoration: 'none' }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Upcoming Milestones ── */}
      <div style={{ ...card, padding: '20px 24px' }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>UPCOMING MILESTONES</h2>
        <div style={divider} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Skeleton w={8} h={8} r={999} />
                <Skeleton w="15%" h={12} />
                <Skeleton w="30%" h={12} />
                <div style={{ flex: 1 }} />
                <Skeleton w={60} h={24} r={999} />
              </div>
            ))}
          </div>
        ) : milestones && milestones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {milestones.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                {m.project_name && (
                  <span style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#808080', flexShrink: 0 }}>{m.project_name}</span>
                )}
                {m.project_name && <span style={{ color: '#d0d0d0' }}>—</span>}
                <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{m.title}</span>
                <span style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#0a0a0a', border: '1px solid #e5e5e5', borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>
                  {fmtDate(m.due_date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', marginTop: 16 }}>No upcoming milestones.</p>
        )}
      </div>

    </div>
  );
}
