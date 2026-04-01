'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

type FilterTab = 'All' | 'In Progress' | 'Review' | 'Completed';

interface DbRequest {
  id: string; title: string; description: string; type: string;
  status: string; priority: string; created_at: string;
}

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
const PRIORITY_COLOR: Record<string, string> = { high: '#e40586', normal: '#fd6100', low: '#bfbfbf' };

const REQUEST_TYPES = ['Brand Design', 'Digital Design', 'Social Media', 'UX Design', 'Photography'];
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

  const [fTitle,    setFTitle]    = useState('');
  const [fDesc,     setFDesc]     = useState('');
  const [fType,     setFType]     = useState('Brand Design');
  const [fPriority, setFPriority] = useState('normal');

  const load = useCallback(async () => {
    setError(false);
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data, error: qErr } = await supabasePortal
      .from('portal_requests').select('*')
      .eq('client_id', user.id).order('created_at', { ascending: false });
    if (qErr) { setError(true); setLoading(false); return; }
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !userId) { setFormError('Title is required'); return; }
    setSubmitting(true); setFormError('');
    const { error: insErr } = await supabasePortal.from('portal_requests').insert({
      client_id: userId, title: fTitle.trim(), description: fDesc.trim(),
      type: fType, priority: fPriority, status: 'kickoff',
    });
    if (insErr) { setFormError(insErr.message); setSubmitting(false); return; }
    setFTitle(''); setFDesc(''); setFType('Brand Design'); setFPriority('normal');
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
    boxSizing: 'border-box', background: '#fff',
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
          {showForm ? 'Cancel' : '+ New Request'}
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
          <h3 style={{ fontFamily: F.bungee, fontSize: 14, color: '#0a0a0a', margin: 0 }}>NEW REQUEST</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title *</label>
                <input style={inp} value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Logo variations" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={fType} onChange={e => setFType(e.target.value)}>
                  {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={fPriority} onChange={e => setFPriority(e.target.value)}>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
                <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: F.inter }} value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Describe what you need…" />
              </div>
            </div>
            {formError && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{formError}</p>}
            <div>
              <button type="submit" disabled={submitting} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#fff', background: submitting ? '#ccc' : '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: submitting ? 'default' : 'pointer' }}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading requests — please refresh.
        </div>
      )}

      {/* Column headers */}
      {!error && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 20px', background: '#f1f0ef', borderRadius: 12 }}>
          {['Request', 'Type', 'Status', 'Priority', 'Date'].map(col => (
            <span key={col} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#808080' }}>{col}</span>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && [1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
            <Skel w="70%" h={14} /><Skel w="60%" h={12} /><Skel w={60} h={22} r={999} /><Skel w={50} h={22} r={999} /><Skel w="50%" h={12} />
          </div>
        </div>
      ))}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="8" width="28" height="24" rx="4" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M13 16h14M13 22h10" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>
            {activeTab === 'All'
              ? 'No requests yet — submit your first request to get started'
              : `No ${activeTab.toLowerCase()} requests`}
          </p>
          {activeTab === 'All' && (
            <button onClick={() => setShowForm(true)} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#e40586', background: 'transparent', border: '1.5px solid #e40586', borderRadius: 999, padding: '7px 20px', cursor: 'pointer' }}>
              + New Request
            </button>
          )}
        </div>
      )}

      {/* Request rows */}
      {!loading && !error && filtered.map(req => {
        const sc = STATUS_COLOR[req.status] ?? '#808080';
        const pc = PRIORITY_COLOR[req.priority] ?? '#808080';
        return (
          <div key={req.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', borderLeft: `4px solid ${sc}`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '16px 20px', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a0a0a' }}>{req.title}</div>
                {req.description && <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginTop: 2 }}>{req.description}</div>}
              </div>
              <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>{req.type}</span>
              <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: sc, background: `${sc}18`, padding: '3px 8px', borderRadius: 999, width: 'fit-content' }}>
                {STATUS_LABEL[req.status] ?? req.status}
              </span>
              <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: pc, background: `${pc}18`, padding: '3px 8px', borderRadius: 999, width: 'fit-content', textTransform: 'capitalize' }}>
                {req.priority}
              </span>
              <span style={{ fontFamily: F.inter, fontSize: 13, color: '#808080' }}>{fmt(req.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
