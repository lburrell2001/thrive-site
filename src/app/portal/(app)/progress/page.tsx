'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbProject {
  id: string; title: string; status: string;
  completion_percentage: number; start_date: string | null; end_date: string | null;
}

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress', review: 'Review',
  kickoff: 'Kickoff', completed: 'Completed', on_hold: 'On Hold',
};
const STATUS_COLOR: Record<string, string> = {
  in_progress: '#e40586', review: '#fd6100',
  kickoff: '#1e3add', completed: '#0cf574', on_hold: '#808080',
};

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef' }} />;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        .from('portal_projects').select('*')
        .eq('client_id', user.id).order('created_at', { ascending: false });
      if (qErr) { setError(true); setLoading(false); return; }
      setProjects(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: '#f6f5f4', minHeight: '100%' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}.skel{animation:pulse 1.5s ease-in-out infinite}`}</style>

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading projects — please refresh.
        </div>
      )}

      {/* Loading skeletons */}
      {loading && [1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Skel w="40%" h={14} /><Skel w={60} h={22} r={999} />
          </div>
          <Skel w="100%" h={8} r={999} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <Skel w={80} h={11} /><Skel w={30} h={11} />
          </div>
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
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>
            No active projects yet
          </p>
        </div>
      )}

      {/* Project cards */}
      {!loading && !error && projects.map(proj => {
        const sc  = STATUS_COLOR[proj.status] ?? '#808080';
        const pct = Math.min(100, Math.max(0, proj.completion_percentage ?? 0));
        return (
          <div key={proj.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', borderLeft: `4px solid ${sc}`, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px' }}>
              {/* Title + status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: F.inter, fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{proj.title}</div>
                <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: sc, background: `${sc}18`, padding: '3px 10px', borderRadius: 999, flexShrink: 0 }}>
                  {STATUS_LABEL[proj.status] ?? proj.status}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, borderRadius: 999, background: '#f1f0ef', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 999, background: sc, width: `${pct}%`, transition: 'width .4s ease' }} />
              </div>

              {/* Footer row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  {proj.start_date && (
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>
                      Started {fmt(proj.start_date)}
                    </span>
                  )}
                  {proj.end_date && (
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>
                      Due {fmt(proj.end_date)}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: F.bungee, fontSize: 13, color: sc }}>{pct}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
