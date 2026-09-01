'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

type FilterTab = 'All' | 'In Progress' | 'Review' | 'Completed';

interface DbRequest {
  id: string; title: string; description: string; type: string;
  status: string; priority: string; created_at: string; project_name?: string | null;
}

interface DbProject { id: string; name: string; archived?: boolean; }

// Sentinel for the "this is something new" option in the project picker.
const NEW_PROJECT = '__new__';

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
const TABS: FilterTab[] = ['All', 'In Progress', 'Review', 'Completed'];

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef' }} />;
}

export default function RequestsPage() {
  const [activeTab,   setActiveTab]   = useState<FilterTab>('All');
  const [requests,    setRequests]    = useState<DbRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');

  const [projects,  setProjects]  = useState<DbProject[]>([]);
  const [fTitle,    setFTitle]    = useState('');
  const [fDesc,     setFDesc]     = useState('');
  const [fProject,  setFProject]  = useState('');
  const [fNewProj,  setFNewProj]  = useState('');

  const load = useCallback(async () => {
    setError(false);
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [reqRes, projRes] = await Promise.all([
      supabasePortal.from('portal_requests').select('*')
        .eq('client_id', user.id).order('created_at', { ascending: false }),
      supabasePortal.from('portal_projects').select('id, name, archived')
        .eq('client_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (reqRes.error) { setError(true); setLoading(false); return; }
    setRequests(reqRes.data ?? []);
    setProjects((projRes.data ?? []).filter((p: DbProject) => !p.archived));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !userId) { setFormError('Tell us what you need, even roughly'); return; }
    if (fProject === NEW_PROJECT && !fNewProj.trim()) {
      setFormError('What would you call this new project?'); return;
    }
    setSubmitting(true); setFormError('');
    // A name that doesn't match an existing project reads as a proposal — it lands
    // in Thrive's inbox, where it becomes a real project or gets filed elsewhere.
    const projectName = fProject === NEW_PROJECT ? fNewProj.trim() : fProject;
    // Type and priority are Thrive's to decide when the brain dump is filed.
    const { error: insErr } = await supabasePortal.from('portal_requests').insert({
      client_id: userId, title: fTitle.trim(), description: fDesc.trim(),
      project_name: projectName || null,
      type: '', priority: 'normal', status: 'kickoff',
    });
    if (insErr) { setFormError(insErr.message); setSubmitting(false); return; }
    setFTitle(''); setFDesc(''); setFProject(''); setFNewProj('');
    setShowForm(false); setSubmitting(false);
    load();
  }

  const TAB_STATUS: Record<FilterTab, string> = {
    'All': '', 'In Progress': 'in_progress', 'Review': 'review', 'Completed': 'completed',
  };
  const filtered = activeTab === 'All'
    ? requests
    : requests.filter(r => r.status === TAB_STATUS[activeTab]);

  const inp: React.CSSProperties = {
    border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px',
    fontFamily: F.inter, fontSize: 14, outline: 'none', width: '100%',
    boxSizing: 'border-box', background: '#fff', color: '#0a0a0a',
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: '#f6f5f4', minHeight: '100%' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}.skel{animation:pulse 1.5s ease-in-out infinite}`}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#fff', background: showForm ? '#808080' : '#e40586', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', transition: 'background .15s' }}
        >
          {showForm ? 'Cancel' : '+ New Brain Dump'}
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer', background: activeTab === tab ? '#0a0a0a' : '#ebe9e7', color: activeTab === tab ? '#fff' : '#808080', transition: 'background .15s' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* New request form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontFamily: F.bungee, fontSize: 14, color: '#0a0a0a', margin: 0 }}>NEW BRAIN DUMP</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>What do you need? *</label>
                <input style={inp} value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Logo variations" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tell us more</label>
                <textarea style={{ ...inp, minHeight: 130, resize: 'vertical', fontFamily: F.inter }} value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Brain dump here — ideas, references, deadlines, anything you're thinking. We'll sort out the details." />
              </div>

              {/* Where it belongs — an existing project, or a brand new one */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Which project?</label>
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  value={fProject}
                  onChange={e => { setFProject(e.target.value); if (e.target.value !== NEW_PROJECT) setFNewProj(''); }}
                >
                  <option value="">Not sure yet — you decide</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  <option value={NEW_PROJECT}>✦ This is something new</option>
                </select>
                {fProject === NEW_PROJECT && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                    <input
                      style={inp}
                      value={fNewProj}
                      onChange={e => setFNewProj(e.target.value)}
                      placeholder="What would you call it? e.g. Spring Campaign"
                    />
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf' }}>
                      We&apos;ll set the project up properly on our end — this just tells us what you have in mind.
                    </span>
                  </div>
                )}
              </div>
            </div>
            {formError && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{formError}</p>}
            <div>
              <button type="submit" disabled={submitting} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#fff', background: submitting ? '#ccc' : '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: submitting ? 'default' : 'pointer' }}>
                {submitting ? 'Sending…' : 'Send It Over'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading your brain dumps — please refresh.
        </div>
      )}

      {/* Column headers */}
      {!error && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1fr', gap: 12, padding: '10px 20px', background: '#f1f0ef', borderRadius: 12 }}>
          {['Brain Dump', 'Project', 'Status', 'Date'].map(col => (
            <span key={col} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#808080' }}>{col}</span>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && [1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
            <Skel w="70%" h={14} /><Skel w="60%" h={12} /><Skel w={60} h={22} r={999} /><Skel w="50%" h={12} />
          </div>
        </div>
      ))}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="8" width="28" height="24" rx="4" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M13 16h14M13 22h10" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>
            {activeTab === 'All'
              ? 'Nothing here yet — dump your first idea and we’ll take it from there'
              : `Nothing ${activeTab.toLowerCase()} right now`}
          </p>
          {activeTab === 'All' && (
            <button onClick={() => setShowForm(true)} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#e40586', background: 'transparent', border: '1.5px solid #e40586', borderRadius: 999, padding: '7px 20px', cursor: 'pointer' }}>
              + New Brain Dump
            </button>
          )}
        </div>
      )}

      {/* Brain dump rows */}
      {!loading && !error && filtered.map(req => {
        const sc = STATUS_COLOR[req.status] ?? '#808080';
        // A project name Thrive hasn't set up yet is still just a suggestion.
        const isRealProject = !!req.project_name && projects.some(p => p.name === req.project_name);
        return (
          <div key={req.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', borderLeft: `4px solid ${sc}`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1fr', gap: 12, padding: '16px 20px', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a' }}>{req.title}</div>
                {req.description && <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginTop: 2, whiteSpace: 'pre-wrap' }}>{req.description}</div>}
              </div>
              {req.project_name ? (
                <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: isRealProject ? '#1e3add' : '#808080', background: isRealProject ? '#eef1ff' : '#f1f0ef', padding: '3px 9px', borderRadius: 999, width: 'fit-content' }}>
                  {isRealProject ? req.project_name : `New: ${req.project_name}`}
                </span>
              ) : (
                <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf' }}>Unassigned</span>
              )}
              <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: sc, background: `${sc}18`, padding: '3px 8px', borderRadius: 999, width: 'fit-content' }}>
                {STATUS_LABEL[req.status] ?? req.status}
              </span>
              <span style={{ fontFamily: F.inter, fontSize: 13, color: '#808080' }}>{fmt(req.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
