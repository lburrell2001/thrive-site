'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

interface Credential {
  id: string;
  project_id: string | null;
  label: string;
  category: string;
  site_url: string;
  username: string;
  has_secret: boolean;
  has_notes: boolean;
  last_viewed_at: string | null;
  last_viewed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DbProject { id: string; name: string; archived?: boolean; }

const CATEGORIES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'website_host', label: 'Website Host',    color: '#1e3add', bg: '#eef1ff' },
  { value: 'domain',       label: 'Domain Registrar', color: '#5b2d8e', bg: '#f3edfb' },
  { value: 'cms',          label: 'CMS / Admin',      color: '#e40586', bg: '#fff0f8' },
  { value: 'ftp',          label: 'FTP / Server',     color: '#fd6100', bg: '#fff4ec' },
  { value: 'analytics',    label: 'Analytics',        color: '#1a8a4a', bg: '#edfff6' },
  { value: 'social',       label: 'Social Account',   color: '#0b7f8f', bg: '#e9f8fa' },
  { value: 'email',        label: 'Email / Mailing',  color: '#8a6d1a', bg: '#fdf7e3' },
  { value: 'other',        label: 'Other',            color: '#808080', bg: '#f1f0ef' },
];

function categoryStyle(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const inp: React.CSSProperties = {
  border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px',
  fontFamily: F.inter, fontSize: 14,
  outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff',
};
const labelStyle: React.CSSProperties = {
  fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

interface FormState {
  label: string; category: string; site_url: string;
  username: string; secret: string; notes: string; projectId: string;
}

const EMPTY_FORM: FormState = {
  label: '', category: 'website_host', site_url: '',
  username: '', secret: '', notes: '', projectId: '',
};

export default function VaultPage() {
  const [items,    setItems]    = useState<Credential[]>([]);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Add / edit form
  const [formOpen,  setFormOpen]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [showSecretField, setShowSecretField] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');
  const [preparing, setPreparing] = useState<string | null>(null);

  // Revealed values, keyed by credential id
  const [revealed,  setRevealed]  = useState<Record<string, { secret: string; notes: string }>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [copied,    setCopied]    = useState('');

  const api = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabasePortal.auth.getSession();
    if (!session) return { error: 'Your session expired — please sign in again.' } as Record<string, unknown>;
    const res = await fetch('/api/portal/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text) as Record<string, unknown>; }
    catch { return { error: `Server error ${res.status}` } as Record<string, unknown>; }
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    const [credRes, projRes] = await Promise.all([
      api({ action: 'list' }),
      supabasePortal.from('portal_projects').select('id, name, archived').eq('client_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (credRes.error) setError(credRes.error as string);
    else { setError(''); setItems((credRes.data as Credential[]) ?? []); }
    setProjects((projRes.data ?? []).filter((p: DbProject) => !p.archived));
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowSecretField(false);
    setFormError('');
    setFormOpen(true);
  }

  async function openEditForm(item: Credential) {
    setPreparing(item.id);
    setFormError('');
    // Pull the real values so the client edits what they actually saved.
    const r = await api({ action: 'reveal', id: item.id });
    setPreparing(null);
    if (r.error) { setError(r.error as string); return; }
    const { secret, notes } = r.data as { secret: string; notes: string };
    setEditingId(item.id);
    setForm({
      label: item.label,
      category: item.category,
      site_url: item.site_url,
      username: item.username,
      secret,
      notes,
      projectId: item.project_id ?? '',
    });
    setShowSecretField(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) { setFormError('Give this entry a name so you both know what it unlocks.'); return; }
    setSaving(true); setFormError('');
    const r = await api({
      action: editingId ? 'update' : 'create',
      id: editingId ?? undefined,
      label: form.label,
      category: form.category,
      site_url: form.site_url,
      username: form.username,
      secret: form.secret,
      notes: form.notes,
      projectId: form.projectId || undefined,
    });
    setSaving(false);
    if (r.error) { setFormError(r.error as string); return; }
    if (editingId) setRevealed(prev => { const next = { ...prev }; delete next[editingId]; return next; });
    closeForm();
    load();
  }

  async function handleReveal(item: Credential) {
    if (revealed[item.id]) {
      setRevealed(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      return;
    }
    setRevealing(item.id);
    const r = await api({ action: 'reveal', id: item.id });
    setRevealing(null);
    if (r.error) { setError(r.error as string); return; }
    setRevealed(prev => ({ ...prev, [item.id]: r.data as { secret: string; notes: string } }));
  }

  async function handleDelete(item: Credential) {
    if (!confirm(`Delete "${item.label}"? Thrive will no longer be able to see this login.`)) return;
    const r = await api({ action: 'delete', id: item.id });
    if (r.error) { setError(r.error as string); return; }
    load();
  }

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? '' : c)), 1600);
    } catch { /* clipboard unavailable — the value is on screen anyway */ }
  }

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? '';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#f6f5f4', minHeight: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .skel{animation:pulse 1.5s ease-in-out infinite}
        .vault-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .vault-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      `}</style>

      {/* ── Security banner ── */}
      <div style={{ background: '#0a0a0a', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="3.5" y="7.5" width="11" height="8" rx="2" stroke="#0cf574" strokeWidth="1.5" />
            <path d="M6 7.5V5.5a3 3 0 016 0v2" stroke="#0cf574" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="11.5" r="1.2" fill="#0cf574" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.bungee, fontSize: 13, color: '#fff', letterSpacing: '-0.01em', marginBottom: 5 }}>
            ENCRYPTED BEFORE IT&apos;S STORED
          </div>
          <p style={{ fontFamily: F.inter, fontSize: 13, color: '#a0a0a0', margin: 0, lineHeight: 1.6 }}>
            Put your website host, domain, and CMS logins here instead of sending them by text or email.
            Every password is encrypted the moment you save it and can only be opened by you and your Thrive team.
            Delete an entry any time the work is done.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          {error}
        </div>
      )}

      {/* ── Add / edit ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#e40586' }} />
        <div style={{ padding: '18px 24px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: F.bungee, fontSize: 13, color: '#0a0a0a', letterSpacing: '-0.01em', marginBottom: 4 }}>
                {editingId ? 'EDIT CREDENTIAL' : 'ADD A CREDENTIAL'}
              </div>
              <div style={{ fontFamily: F.inter, fontSize: 13, color: '#808080' }}>
                Hosting, domain, CMS, FTP, analytics — anything the team needs access to.
              </div>
            </div>
            <button
              type="button"
              onClick={() => (formOpen ? closeForm() : openAddForm())}
              style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: formOpen ? '#808080' : '#fff', background: formOpen ? '#f1f0ef' : '#e40586', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer' }}
            >
              {formOpen ? 'Cancel' : '+ Add Credential'}
            </button>
          </div>

          {formOpen && (
            <form onSubmit={handleSave} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="vault-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>Name *</label>
                  <input style={inp} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="GoDaddy hosting" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>Type</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>Login URL</label>
                  <input style={inp} value={form.site_url} onChange={e => setForm(f => ({ ...f, site_url: e.target.value }))} placeholder="https://godaddy.com/login" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>Username / Email</label>
                  <input style={inp} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="you@company.com" autoComplete="off" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>Password / Key</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{ ...inp, paddingRight: 58 }}
                      type={showSecretField ? 'text' : 'password'}
                      value={form.secret}
                      onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretField(v => !v)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#1e3add', cursor: 'pointer', padding: 4 }}
                    >
                      {showSecretField ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                {projects.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={labelStyle}>Project (optional)</label>
                    <select style={{ ...inp, cursor: 'pointer' }} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                      <option value="">Not project specific</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea
                  style={{ ...inp, minHeight: 78, resize: 'vertical', fontFamily: F.inter }}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Two-factor codes go to my phone — text me when you need one. Account number 4429."
                />
                <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf' }}>
                  Notes are encrypted the same way as the password.
                </span>
              </div>

              {formError && (
                <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{formError}</p>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#fff', background: saving ? '#ccc' : '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Securely'}
                </button>
                <button type="button" onClick={closeForm} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#808080', background: 'transparent', border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Saved credentials ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} className="skel" style={{ height: 108, borderRadius: 12, background: '#eceae8' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: '52px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#eef1ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="#1e3add" strokeWidth="1.6" />
              <path d="M8 10V7a4 4 0 018 0v3" stroke="#1e3add" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontFamily: F.inter, fontSize: 14, color: '#808080', margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            Nothing stored yet. Add your first login and your Thrive team can get to work without you sending
            anything over text or email.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const cat  = categoryStyle(item.category);
            const open = revealed[item.id];
            const proj = projectName(item.project_id);
            return (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
                <div style={{ height: 3, background: cat.color }} />
                <div style={{ padding: '16px 20px 18px' }}>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div className="vault-row" style={{ marginBottom: 4 }}>
                        <span style={{ fontFamily: F.inter, fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{item.label}</span>
                        <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: cat.bg, color: cat.color, padding: '2px 9px', borderRadius: 999 }}>{cat.label}</span>
                        {proj && <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: '#f1f0ef', color: '#808080', padding: '2px 9px', borderRadius: 999 }}>{proj}</span>}
                      </div>
                      {item.site_url && (
                        <a href={item.site_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, color: '#1e3add', textDecoration: 'none', wordBreak: 'break-all' }}>
                          {item.site_url} ↗
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        disabled={preparing === item.id}
                        style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#808080', background: 'transparent', border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
                      >
                        {preparing === item.id ? 'Opening…' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: '#e40586', background: 'transparent', border: '1.5px solid #fbc8e8', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{ background: '#fafafa', border: '1px solid #f1f0ef', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="vault-row">
                      <span style={{ ...labelStyle, width: 74 }}>User</span>
                      <span style={{ fontFamily: F.inter, fontSize: 13, color: item.username ? '#0a0a0a' : '#bfbfbf', flex: 1, minWidth: 120, wordBreak: 'break-all' }}>
                        {item.username || 'Not provided'}
                      </span>
                      {item.username && (
                        <button type="button" onClick={() => copyValue(`u-${item.id}`, item.username)} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#1e3add', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          {copied === `u-${item.id}` ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>

                    <div className="vault-row">
                      <span style={{ ...labelStyle, width: 74 }}>Password</span>
                      <span style={{ fontFamily: open ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : F.inter, fontSize: 13, color: item.has_secret ? '#0a0a0a' : '#bfbfbf', flex: 1, minWidth: 120, wordBreak: 'break-all' }}>
                        {!item.has_secret ? 'Not provided' : open ? (open.secret || '—') : '••••••••••'}
                      </span>
                      {item.has_secret && (
                        <>
                          <button type="button" onClick={() => handleReveal(item)} disabled={revealing === item.id} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#1e3add', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            {revealing === item.id ? '…' : open ? 'Hide' : 'Show'}
                          </button>
                          {open && (
                            <button type="button" onClick={() => copyValue(`p-${item.id}`, open.secret)} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#1e3add', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              {copied === `p-${item.id}` ? 'Copied' : 'Copy'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {item.has_notes && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ ...labelStyle, width: 74, flexShrink: 0, paddingTop: 2 }}>Notes</span>
                        <span style={{ fontFamily: F.inter, fontSize: 13, color: '#0a0a0a', flex: 1, whiteSpace: 'pre-wrap' }}>
                          {open ? (open.notes || '—') : '•••••• (shown with the password)'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
                    <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>Added {fmtDate(item.created_at)}</span>
                    {item.last_viewed_at && (
                      <span style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf' }}>
                        Last opened by {item.last_viewed_by ?? 'Thrive'} on {fmtDate(item.last_viewed_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
