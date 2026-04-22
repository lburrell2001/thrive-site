'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbStage   { key: string; label: string; }
interface DbProject {
  id: string;
  name: string;
  status: string;
  progress: number;
  color: string;
  stages?: DbStage[];
}

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
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      const { data, error: qErr } = await supabasePortal
        .from('portal_projects').select('id, name, status, progress, color')
        .eq('client_id', user.id).order('created_at', { ascending: false });
      if (qErr) { setError(true); setLoading(false); return; }
      setProjects(data ?? []);
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
      {!loading && !error && projects.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#1e3add18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e3add" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>No active projects yet</p>
        </div>
      )}

      {/* Project cards */}
      {!loading && !error && projects.map(proj => {
        const accent = proj.color || STATUS_COLOR[proj.status] || '#808080';
        const pct    = Math.min(100, Math.max(0, proj.progress ?? 0));
        const STAGES = proj.stages?.length ? proj.stages : DEFAULT_STAGES;
        const activeStageIdx = STAGES.findIndex(s => s.key === proj.status);

        return (
          <div key={proj.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
            {/* Top accent bar */}
            <div style={{ height: 4, background: accent }} />

            <div style={{ padding: '20px 24px 24px' }}>
              {/* Project name + percentage */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                <div style={{ fontFamily: F.bungee, fontSize: 18, color: '#0a0a0a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {proj.name}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: F.bungee, fontSize: 28, color: accent, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontFamily: F.inter, fontSize: 11, color: '#808080', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>complete</div>
                </div>
              </div>

              {/* Stage pipeline */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(STAGES.length, 4)}, 1fr)`, gap: 6, marginBottom: 20 }}>
                {STAGES.map((stage, idx) => {
                  const isPast    = activeStageIdx > idx;
                  const isCurrent = activeStageIdx === idx;
                  const isFuture  = activeStageIdx < idx && activeStageIdx !== -1;
                  const isUnknown = activeStageIdx === -1;
                  return (
                    <div
                      key={stage.key}
                      style={{
                        borderRadius: 8,
                        padding: '10px 8px',
                        textAlign: 'center',
                        background: isCurrent ? accent : isPast ? `${accent}22` : '#f6f5f4',
                        border: isCurrent ? `2px solid ${accent}` : isPast ? `1.5px solid ${accent}55` : '1.5px solid #e5e5e5',
                        opacity: isFuture || isUnknown ? 0.5 : 1,
                        transition: 'all .2s',
                      }}
                    >
                      <div style={{
                        fontFamily: F.inter, fontSize: 10, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: isCurrent ? '#fff' : isPast ? accent : '#808080',
                        marginBottom: 3,
                      }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div style={{
                        fontFamily: F.inter, fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? '#fff' : isPast ? accent : '#808080',
                      }}>
                        {stage.label}
                      </div>
                      {isPast && (
                        <div style={{ marginTop: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6" r="5" fill={accent} />
                            <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div style={{ height: 10, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden' }}>
                <div
                  className="prog-fill"
                  style={{ height: '100%', borderRadius: 999, background: accent, width: `${pct}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>0%</span>
                <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>100%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
