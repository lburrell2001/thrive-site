'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbStage    { key: string; label: string; }
interface DbProject  { id: string; name: string; status: string; progress: number; color: string; stages?: DbStage[]; archived?: boolean; }
interface DbInvoice  { id: string; invoice_number: string; amount_cents: number; due_date: string; status: string; }
interface DbFile     { id: string; name: string; file_url: string; }
interface DbProposal { id: string; name: string; file_url: string; signed_file_url: string | null; status: string; }

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
  kickoff:     '#1e3add',
  in_progress: '#e40586',
  review:      '#fd6100',
  completed:   '#0cf574',
  on_hold:     '#808080',
};

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef' }} />;
}

export default function ProgressPage() {
  const [projects,     setProjects]     = useState<DbProject[]>([]);
  const [invoices,     setInvoices]     = useState<DbInvoice[]>([]);
  const [files,        setFiles]        = useState<DbFile[]>([]);
  const [proposals,    setProposals]    = useState<DbProposal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      const [projRes, invRes, fileRes, propRes] = await Promise.all([
        // select('*') avoids hard failures when optional columns (stages, archived) haven't been added to the DB yet
        supabasePortal.from('portal_projects').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
        supabasePortal.from('portal_invoices').select('id, invoice_number, amount_cents, due_date, status, project_name').eq('client_id', user.id),
        supabasePortal.from('portal_files').select('id, name, file_url, project_name').eq('client_id', user.id),
        supabasePortal.from('portal_proposals').select('id, name, file_url, signed_file_url, status, project_id').eq('client_id', user.id),
      ]);
      if (projRes.error) { setError(true); setLoading(false); return; }
      setProjects(projRes.data ?? []);
      setInvoices((invRes.data ?? []) as (DbInvoice & { project_name?: string })[]);
      setFiles((fileRes.data ?? []) as (DbFile & { project_name?: string })[]);
      setProposals((propRes.data ?? []) as (DbProposal & { project_id?: string })[]);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: '#f6f5f4', minHeight: '100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .skel{animation:pulse 1.5s ease-in-out infinite}
        @keyframes fillbar { from { width: 0 } }
        .prog-fill { animation: fillbar .6s ease forwards; }
      `}</style>

      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading projects — please refresh.
        </div>
      )}

      {/* Loading skeletons */}
      {loading && [1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Skel w="50%" h={18} /><Skel w={80} h={26} r={8} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[1,2,3,4].map(j => <Skel key={j} w="25%" h={36} r={8} />)}
          </div>
          <Skel w="100%" h={10} r={999} />
        </div>
      ))}

      {/* Empty state */}
      {!loading && !error && projects.filter(p => !p.archived).length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#1e3add18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e3add" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>No active projects yet</p>
        </div>
      )}

      {/* Active project cards */}
      {!loading && !error && projects.filter(p => !p.archived).map(proj => (
        <ProjectCard
          key={proj.id}
          proj={proj}
          invoices={invoices.filter(i => (i as DbInvoice & { project_name?: string }).project_name === proj.name)}
          files={files.filter(f => (f as DbFile & { project_name?: string }).project_name === proj.name)}
          proposals={proposals.filter(p => (p as DbProposal & { project_id?: string }).project_id === proj.id)}
        />
      ))}

      {/* Archived section */}
      {!loading && !error && projects.some(p => p.archived) && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '14px 20px', width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#808080', flex: 1 }}>
              Archived Projects ({projects.filter(p => p.archived).length})
            </span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: 'transform .2s', transform: showArchived ? 'rotate(180deg)' : 'rotate(0)' }}>
              <path d="M3 5l4 4 4-4" stroke="#bfbfbf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
              {projects.filter(p => p.archived).map(proj => (
                <ProjectCard
                  key={proj.id}
                  proj={proj}
                  archived
                  invoices={invoices.filter(i => (i as DbInvoice & { project_name?: string }).project_name === proj.name)}
                  files={files.filter(f => (f as DbFile & { project_name?: string }).project_name === proj.name)}
                  proposals={proposals.filter(p => (p as DbProposal & { project_id?: string }).project_id === proj.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtCurrency(c: number) { return (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

const INV_COLOR: Record<string, string> = { due: '#fd6100', paid: '#0cf574', overdue: '#e40586' };
const INV_BG:    Record<string, string> = { due: '#fff4ec', paid: '#edfff6', overdue: '#fff0f8' };

function ProjectCard({ proj, archived = false, invoices = [], files = [], proposals = [] }: {
  proj: DbProject; archived?: boolean;
  invoices?: DbInvoice[]; files?: DbFile[]; proposals?: DbProposal[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const accent = proj.color || STATUS_COLOR[proj.status] || '#808080';
  const pct    = Math.min(100, Math.max(0, proj.progress ?? 0));
  const STAGES = proj.stages?.length ? proj.stages : DEFAULT_STAGES;
  const activeStageIdx = STAGES.findIndex(s => s.key === proj.status);
  const stageAccent = archived ? '#bfbfbf' : accent;
  const hasDetails = invoices.length > 0 || files.length > 0 || proposals.length > 0;

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden', opacity: archived ? 0.75 : 1 }}>
      <div style={{ height: 4, background: archived ? '#d0d0d0' : accent }} />

      <div style={{ padding: '20px 24px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: F.bungee, fontSize: 18, color: archived ? '#808080' : '#0a0a0a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {proj.name}
            </div>
            {archived && <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', background: '#f0f0f0', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginTop: 4 }}>ARCHIVED</span>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: F.bungee, fontSize: 28, color: archived ? '#bfbfbf' : accent, lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontFamily: F.inter, fontSize: 11, color: '#808080', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>complete</div>
          </div>
        </div>

        {/* Stage pipeline */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(STAGES.length, 4)}, 1fr)`, gap: 6, marginBottom: 20 }}>
          {STAGES.map((stage, idx) => {
            const isPast = activeStageIdx > idx, isCurrent = activeStageIdx === idx;
            const isFuture = activeStageIdx < idx && activeStageIdx !== -1, isUnknown = activeStageIdx === -1;
            return (
              <div key={stage.key} style={{ borderRadius: 8, padding: '10px 8px', textAlign: 'center', background: isCurrent ? stageAccent : isPast ? `${stageAccent}22` : '#f6f5f4', border: isCurrent ? `2px solid ${stageAccent}` : isPast ? `1.5px solid ${stageAccent}55` : '1.5px solid #e5e5e5', opacity: isFuture || isUnknown ? 0.5 : 1, transition: 'all .2s' }}>
                <div style={{ fontFamily: F.inter, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isCurrent ? '#fff' : isPast ? stageAccent : '#808080', marginBottom: 3 }}>{String(idx + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: F.inter, fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#fff' : isPast ? stageAccent : '#808080' }}>{stage.label}</div>
                {isPast && <div style={{ marginTop: 4 }}><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill={stageAccent} /><path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 10, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden' }}>
          <div className="prog-fill" style={{ height: '100%', borderRadius: 999, background: archived ? '#d0d0d0' : accent, width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>0%</span>
          <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>100%</span>
        </div>

        {/* Toggle details */}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform .2s', transform: showDetails ? 'rotate(90deg)' : 'rotate(0)' }}>
              <path d="M4 2.5l4 3.5-4 3.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: accent }}>
              {showDetails ? 'Hide details' : `View details (${invoices.length + files.length + proposals.length} items)`}
            </span>
          </button>
        )}
      </div>

      {/* Details panel */}
      {showDetails && (
        <div style={{ borderTop: '1px solid #f1f0ef' }}>

          {/* Proposals */}
          {proposals.length > 0 && (
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f0ef' }}>
              <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Proposals</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {proposals.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#808080" strokeWidth="1.2"/><path d="M10 2v3h3" stroke="#808080" strokeWidth="1.2"/></svg>
                    <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{p.name}</span>
                    <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: p.status === 'signed' ? '#edfff6' : '#fff4ec', color: p.status === 'signed' ? '#1a8a4a' : '#fd6100', padding: '2px 8px', borderRadius: 999 }}>{p.status}</span>
                    <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1e3add', textDecoration: 'none' }}>View ↗</a>
                    {p.signed_file_url && <a href={p.signed_file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1a8a4a', textDecoration: 'none' }}>Signed ↗</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <div style={{ padding: '14px 24px', borderBottom: files.length > 0 ? '1px solid #f1f0ef' : 'none' }}>
              <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Invoices</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invoices.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#0a0a0a', minWidth: 64 }}>{inv.invoice_number}</span>
                    <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#0a0a0a', flex: 1 }}>{fmtCurrency(inv.amount_cents)}</span>
                    {inv.due_date && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>Due {fmtDate(inv.due_date)}</span>}
                    <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: INV_BG[inv.status] ?? '#f1f0ef', color: INV_COLOR[inv.status] ?? '#808080', padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>{inv.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div style={{ padding: '14px 24px' }}>
              <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Files</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#808080" strokeWidth="1.2"/><path d="M10 2v3h3" stroke="#808080" strokeWidth="1.2"/></svg>
                    <span style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{f.name}</span>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1e3add', textDecoration: 'none' }}>Download ↗</a>
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
