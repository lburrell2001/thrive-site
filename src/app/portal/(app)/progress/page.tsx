'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbStage    { key: string; label: string; }
interface DbProject  { id: string; name: string; status: string; progress: number; color: string; stages?: DbStage[]; archived?: boolean; }
interface DbInvoice  { id: string; invoice_number: string; amount_cents: number; invoice_date: string; due_date: string; status: string; project_name?: string; }
interface DbFile     { id: string; name: string; file_url: string; project_name?: string; }
interface DbProposal { id: string; name: string; file_url: string; signed_file_url: string | null; status: string; project_id?: string; }
interface DbMilestone { id: string; title: string; due_date: string; color: string; completed: boolean; project_name?: string; }
interface DbRequest  { id: string; title: string; type: string; status: string; priority: string; project_name?: string; created_at: string; }
interface DbActivity { id: string; text: string; dot_color: string; created_at: string; project_name?: string; }

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

const DEFAULT_STAGES: DbStage[] = [
  { key: 'kickoff',     label: 'Kickoff' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review',      label: 'Review' },
  { key: 'completed',   label: 'Completed' },
];

const STATUS_COLOR: Record<string, string> = {
  kickoff: '#1e3add', in_progress: '#e40586', review: '#fd6100', completed: '#0cf574', on_hold: '#808080',
};
const INV_COLOR: Record<string, string> = { due: '#fd6100', paid: '#0cf574', overdue: '#e40586' };
const INV_BG:    Record<string, string> = { due: '#fff4ec', paid: '#edfff6', overdue: '#fff0f8' };
const PRI_COLOR: Record<string, string> = { high: '#e40586', normal: '#1e3add', low: '#808080' };
const PRI_BG:    Record<string, string> = { high: '#fff0f8', normal: '#eef1ff', low: '#f1f0ef' };
const REQ_COLOR: Record<string, string> = { kickoff: '#1e3add', in_progress: '#e40586', review: '#fd6100', completed: '#0cf574' };
const REQ_BG:    Record<string, string> = { kickoff: '#eef1ff', in_progress: '#fff0f8', review: '#fff4ec', completed: '#edfff6' };

function fmtCurrency(c: number) { return (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }); }
function fmtDate(s: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function relTime(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef' }} />;
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {count !== undefined && <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', background: '#f1f0ef', padding: '1px 7px', borderRadius: 999 }}>{count}</span>}
    </div>
  );
}

export default function ProgressPage() {
  const [projects,   setProjects]   = useState<DbProject[]>([]);
  const [invoices,   setInvoices]   = useState<DbInvoice[]>([]);
  const [files,      setFiles]      = useState<DbFile[]>([]);
  const [proposals,  setProposals]  = useState<DbProposal[]>([]);
  const [milestones, setMilestones] = useState<DbMilestone[]>([]);
  const [requests,   setRequests]   = useState<DbRequest[]>([]);
  const [activity,   setActivity]   = useState<DbActivity[]>([]);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [projRes, invRes, fileRes, propRes, msRes, reqRes, actRes] = await Promise.all([
      supabasePortal.from('portal_projects').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabasePortal.from('portal_invoices').select('*').eq('client_id', user.id).order('invoice_date', { ascending: false }),
      supabasePortal.from('portal_files').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabasePortal.from('portal_proposals').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabasePortal.from('portal_milestones').select('*').eq('client_id', user.id).order('due_date', { ascending: true }),
      supabasePortal.from('portal_requests').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabasePortal.from('portal_activity').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (projRes.error) { setError(true); setLoading(false); return; }
    setProjects(projRes.data ?? []);
    setInvoices(invRes.data ?? []);
    setFiles(fileRes.data ?? []);
    setProposals(propRes.data ?? []);
    setMilestones(msRes.data ?? []);
    setRequests(reqRes.data ?? []);
    setActivity(actRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function projectData(proj: DbProject) {
    return {
      invoices:   invoices.filter(i => i.project_name === proj.name),
      files:      files.filter(f => f.project_name === proj.name),
      proposals:  proposals.filter(p => p.project_id === proj.id),
      milestones: milestones.filter(m => m.project_name === proj.name),
      requests:   requests.filter(r => r.project_name === proj.name),
      activity:   activity.filter(a => a.project_name === proj.name),
    };
  }

  const active   = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#f6f5f4', minHeight: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .skel{animation:pulse 1.5s ease-in-out infinite}
        @keyframes fillbar{from{width:0}}
        .prog-fill{animation:fillbar .6s ease forwards}
        .proj-section + .proj-section { border-top: 1px solid #f1f0ef; }
      `}</style>

      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading projects — please refresh.
        </div>
      )}

      {/* Loading skeletons */}
      {loading && [1, 2].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Skel w="50%" h={18} /><Skel w={80} h={28} r={8} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[1,2,3,4].map(j => <Skel key={j} w="25%" h={48} r={8} />)}
          </div>
          <Skel h={10} r={999} />
        </div>
      ))}

      {/* Empty state */}
      {!loading && !error && active.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#1e3add18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e3add" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>No active projects yet</p>
        </div>
      )}

      {/* Active projects */}
      {!loading && !error && active.map(proj => (
        <ProjectCard key={proj.id} proj={proj} userId={userId} onRefresh={load} {...projectData(proj)} />
      ))}

      {/* Archived section */}
      {!loading && !error && (
        <div style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '14px 20px', width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#808080', flex: 1 }}>
              Archived Projects ({archived.length})
            </span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: 'transform .2s', transform: showArchived ? 'rotate(180deg)' : 'rotate(0)' }}>
              <path d="M3 5l4 4 4-4" stroke="#bfbfbf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
              {archived.length === 0
                ? <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0, padding: '4px' }}>No archived projects.</p>
                : archived.map(proj => <ProjectCard key={proj.id} proj={proj} userId={userId} onRefresh={load} archived {...projectData(proj)} />)
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ proj, archived = false, userId, onRefresh, invoices, files, proposals, milestones, requests, activity }: {
  proj: DbProject; archived?: boolean; userId: string | null; onRefresh: () => void;
  invoices: DbInvoice[]; files: DbFile[]; proposals: DbProposal[];
  milestones: DbMilestone[]; requests: DbRequest[]; activity: DbActivity[];
}) {
  const [expanded, setExpanded]     = useState(false);
  const [payingId, setPayingId]     = useState<string | null>(null);
  const [payError, setPayError]     = useState('');
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqTitle,  setReqTitle]    = useState('');
  const [reqType,   setReqType]     = useState('Brand Design');
  const [reqPri,    setReqPri]      = useState('normal');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqError, setReqError]     = useState('');

  const accent      = proj.color || STATUS_COLOR[proj.status] || '#808080';
  const dimAccent   = archived ? '#bfbfbf' : accent;
  const pct         = Math.min(100, Math.max(0, proj.progress ?? 0));
  const STAGES      = proj.stages?.length ? proj.stages : DEFAULT_STAGES;
  const activeIdx   = STAGES.findIndex(s => s.key === proj.status);
  const totalItems  = invoices.length + files.length + proposals.length + milestones.length + requests.length;

  async function handlePay(inv: DbInvoice) {
    setPayingId(inv.id); setPayError('');
    try {
      const res  = await fetch('/api/portal/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.id, amount: inv.amount_cents / 100, description: `Invoice ${inv.invoice_number} — ${proj.name}` }) });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setPayError(data.error ?? 'Payment error'); return; }
      window.location.href = data.url;
    } catch { setPayError('An unexpected error occurred.'); }
    finally { setPayingId(null); }
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqTitle.trim() || !userId) { setReqError('Title is required'); return; }
    setReqSubmitting(true); setReqError('');
    const { error } = await supabasePortal.from('portal_requests').insert({
      client_id: userId, title: reqTitle.trim(), type: reqType,
      priority: reqPri, status: 'kickoff', project_name: proj.name,
    });
    setReqSubmitting(false);
    if (error) { setReqError(error.message); return; }
    setReqTitle(''); setReqType('Brand Design'); setReqPri('normal'); setShowReqForm(false);
    onRefresh();
  }

  const inp: React.CSSProperties = { border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', fontFamily: F.inter, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff' };
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: expanded ? `2px solid ${dimAccent}` : '1px solid #e5e5e5', overflow: 'hidden', opacity: archived ? 0.8 : 1, transition: 'border-color .15s' }}>
      {/* Accent bar */}
      <div style={{ height: 4, background: dimAccent }} />

      {/* Header — click to expand */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '18px 24px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: dimAccent, flexShrink: 0 }} />
            <span style={{ fontFamily: F.bungee, fontSize: 16, color: archived ? '#808080' : '#0a0a0a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{proj.name}</span>
            {archived && <span style={{ fontFamily: F.inter, fontSize: 10, fontWeight: 700, color: '#808080', background: '#f0f0f0', padding: '1px 7px', borderRadius: 999 }}>ARCHIVED</span>}
          </div>
          {/* Mini progress bar */}
          <div style={{ height: 4, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden', maxWidth: 240 }}>
            <div style={{ height: '100%', borderRadius: 999, background: dimAccent, width: `${pct}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>{pct}% complete</span>
            {totalItems > 0 && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf' }}>· {totalItems} item{totalItems !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontFamily: F.bungee, fontSize: 24, color: dimAccent, lineHeight: 1 }}>{pct}%</div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            <path d="M4 6l4 4 4-4" stroke="#bfbfbf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f0ef' }}>

          {/* Stage pipeline */}
          <div className="proj-section" style={{ padding: '20px 24px' }}>
            <SectionLabel label="Stages" />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(STAGES.length, 4)}, 1fr)`, gap: 6, marginBottom: 16 }}>
              {STAGES.map((stage, idx) => {
                const isPast = activeIdx > idx, isCurrent = activeIdx === idx;
                const isFuture = activeIdx < idx && activeIdx !== -1, isUnknown = activeIdx === -1;
                return (
                  <div key={stage.key} style={{ borderRadius: 8, padding: '10px 8px', textAlign: 'center', background: isCurrent ? dimAccent : isPast ? `${dimAccent}22` : '#f6f5f4', border: isCurrent ? `2px solid ${dimAccent}` : isPast ? `1.5px solid ${dimAccent}55` : '1.5px solid #e5e5e5', opacity: isFuture || isUnknown ? 0.5 : 1, transition: 'all .2s' }}>
                    <div style={{ fontFamily: F.inter, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isCurrent ? '#fff' : isPast ? dimAccent : '#808080', marginBottom: 3 }}>{String(idx + 1).padStart(2, '0')}</div>
                    <div style={{ fontFamily: F.inter, fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#fff' : isPast ? dimAccent : '#808080' }}>{stage.label}</div>
                    {isPast && <div style={{ marginTop: 4 }}><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill={dimAccent}/><path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
                  </div>
                );
              })}
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden' }}>
              <div className="prog-fill" style={{ height: '100%', borderRadius: 999, background: dimAccent, width: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>0%</span>
              <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>100%</span>
            </div>
          </div>

          {/* Invoices */}
          <div className="proj-section" style={{ padding: '20px 24px' }}>
            <SectionLabel label="Invoices" count={invoices.length} />
            {invoices.length === 0
              ? <p style={{ fontFamily: F.inter, fontSize: 13, color: '#bfbfbf', margin: 0 }}>No invoices yet.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.map(inv => {
                    const canPay = inv.status === 'due' || inv.status === 'overdue';
                    const isPaying = payingId === inv.id;
                    return (
                      <div key={inv.id} style={{ border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fafafa' }}>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{inv.invoice_number}</div>
                          <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginTop: 2 }}>
                            {fmtCurrency(inv.amount_cents)}
                            {inv.due_date && ` · Due ${fmtDate(inv.due_date)}`}
                          </div>
                        </div>
                        <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: INV_BG[inv.status] ?? '#f1f0ef', color: INV_COLOR[inv.status] ?? '#808080', padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize', flexShrink: 0 }}>
                          {inv.status}
                        </span>
                        {canPay && (
                          <button onClick={() => handlePay(inv)} disabled={!!payingId} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#fff', background: '#e40586', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: payingId ? 'default' : 'pointer', opacity: payingId ? 0.6 : 1, flexShrink: 0 }}>
                            {isPaying ? '…' : `Pay ${fmtCurrency(inv.amount_cents)}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {payError && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{payError}</p>}
                </div>
            }
          </div>

          {/* Requests */}
          <div className="proj-section" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SectionLabel label="Requests" count={requests.length} />
              {!archived && (
                <button onClick={() => setShowReqForm(v => !v)} style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#e40586', background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                  {showReqForm ? 'Cancel' : '+ New'}
                </button>
              )}
            </div>
            {showReqForm && (
              <form onSubmit={handleSubmitRequest} style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080' }}>TITLE *</label>
                    <input style={inp} value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Logo revision" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080' }}>TYPE</label>
                    <select style={sel} value={reqType} onChange={e => setReqType(e.target.value)}>
                      {['Brand Design','Digital Design','Social Media','UX Design','Photography'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080' }}>PRIORITY</label>
                    <select style={sel} value={reqPri} onChange={e => setReqPri(e.target.value)}>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                {reqError && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{reqError}</p>}
                <button type="submit" disabled={reqSubmitting} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#fff', background: '#0a0a0a', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: reqSubmitting ? 'default' : 'pointer', opacity: reqSubmitting ? 0.5 : 1, alignSelf: 'flex-start' }}>
                  {reqSubmitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            )}
            {requests.length === 0
              ? <p style={{ fontFamily: F.inter, fontSize: 13, color: '#bfbfbf', margin: 0 }}>No requests yet.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fafafa' }}>
                      <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: PRI_BG[req.priority] ?? '#f1f0ef', color: PRI_COLOR[req.priority] ?? '#808080', padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize', flexShrink: 0 }}>{req.priority}</span>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{req.title}</div>
                        {req.type && <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginTop: 1 }}>{req.type}</div>}
                      </div>
                      <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: REQ_BG[req.status] ?? '#f1f0ef', color: REQ_COLOR[req.status] ?? '#808080', padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize', flexShrink: 0 }}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Proposals */}
          {proposals.length > 0 && (
            <div className="proj-section" style={{ padding: '20px 24px' }}>
              <SectionLabel label="Proposals" count={proposals.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposals.map(p => (
                  <div key={p.id} style={{ border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fafafa' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#808080" strokeWidth="1.2"/><path d="M10 2v3h3" stroke="#808080" strokeWidth="1.2"/></svg>
                    <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{p.name}</span>
                    <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: p.status === 'signed' ? '#edfff6' : '#fff4ec', color: p.status === 'signed' ? '#1a8a4a' : '#fd6100', padding: '2px 8px', borderRadius: 999 }}>{p.status}</span>
                    <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1e3add', textDecoration: 'none' }}>View ↗</a>
                    {p.signed_file_url && <a href={p.signed_file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1a8a4a', textDecoration: 'none' }}>Signed ↗</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="proj-section" style={{ padding: '20px 24px' }}>
              <SectionLabel label="Files & Assets" count={files.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map(f => (
                  <div key={f.id} style={{ border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: '#fafafa' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#808080" strokeWidth="1.2"/><path d="M10 2v3h3" stroke="#808080" strokeWidth="1.2"/></svg>
                    <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{f.name}</span>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1e3add', textDecoration: 'none' }}>Download ↗</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="proj-section" style={{ padding: '20px 24px' }}>
              <SectionLabel label="Milestones" count={milestones.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {milestones.map(m => (
                  <div key={m.id} style={{ border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fafafa' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: m.completed ? '#bfbfbf' : '#0a0a0a', flex: 1, textDecoration: m.completed ? 'line-through' : 'none' }}>{m.title}</span>
                    {m.due_date && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', background: '#f1f0ef', padding: '2px 9px', borderRadius: 999 }}>{fmtDate(m.due_date)}</span>}
                    {m.completed && <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#1a8a4a', background: '#edfff6', padding: '2px 8px', borderRadius: 999 }}>Done</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          {activity.length > 0 && (
            <div className="proj-section" style={{ padding: '20px 24px' }}>
              <SectionLabel label="Activity" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activity.slice(0, 8).map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < Math.min(activity.length, 8) - 1 ? 12 : 0, borderBottom: i < Math.min(activity.length, 8) - 1 ? '1px solid #f1f0ef' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot_color, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: F.inter, fontSize: 14, color: '#0a0a0a' }}>{item.text}</span>
                      <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf', marginLeft: 8 }}>{relTime(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
