'use client';

import { useEffect, useState, useCallback } from 'react';

const F = {
  inter: `var(--font-inter), 'Inter', sans-serif`,
};

// ── Design tokens ──────────────────────────────────────────────────────────────
const PINK   = '#e40586';
const PURPLE = '#5b2d8e';
const GREEN  = '#0cf574';
const ORANGE = '#fd6100';
const BLUE   = '#1e3add';
const DARK   = '#0a0a0a';

const INPUT: React.CSSProperties = {
  border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px',
  fontFamily: F.inter, fontSize: 13, outline: 'none',
  width: '100%', boxSizing: 'border-box', background: '#fff', color: DARK,
};
const SELECT: React.CSSProperties = { ...INPUT, cursor: 'pointer' };
const LABEL: React.CSSProperties = {
  fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080',
  marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const AVATAR_COLORS = [PINK, PURPLE, BLUE, ORANGE, '#1a8a4a', '#c07000'];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const COLOR_SWATCHES = [PINK, ORANGE, GREEN, BLUE, PURPLE, DARK, '#808080'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  due:         { bg: '#fff4ec', color: ORANGE },
  paid:        { bg: '#edfff6', color: '#1a8a4a' },
  overdue:     { bg: '#fff0f8', color: PINK },
  kickoff:     { bg: '#eef1ff', color: BLUE },
  in_progress: { bg: '#fff0f8', color: PINK },
  review:      { bg: '#fff4ec', color: ORANGE },
  completed:   { bg: '#edfff6', color: '#1a8a4a' },
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface Client { id: string; full_name: string; company_name: string; initials: string; role: string; email?: string | null; }
interface Project { id: string; name: string; status: string; progress: number; color: string; }
interface Invoice { id: string; invoice_number: string; project_name: string; amount_cents: number; invoice_date: string; due_date: string; status: string; }
interface Request { id: string; title: string; type: string; status: string; priority: string; }
interface PortalFile { id: string; name: string; project_name: string; file_url: string; }
interface OnboardingStep { id: string; step_number: number; title: string; description: string; action_label: string; action_href: string; completed: boolean; }
interface Activity { id: string; text: string; dot_color: string; created_at: string; }
interface Milestone { id: string; project_name: string; title: string; due_date: string; color: string; completed: boolean; }
interface ClientData { profile: Client | null; projects: Project[]; requests: Request[]; invoices: Invoice[]; files: PortalFile[]; milestones: Milestone[]; onboarding: OnboardingStep[]; activity: Activity[]; }
type Tab = 'profile' | 'projects' | 'invoices' | 'requests' | 'files' | 'onboarding' | 'milestones' | 'activity' | 'settings';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtAmount(cents: number) { return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function fmtDate(s: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function relTime(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}

// ── Small components ───────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: '#f1f0ef', color: '#808080' };
  return (
    <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function Avatar({ name, initials, size = 40 }: { name: string; initials: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: F.inter, color: '#fff', fontSize: size * 0.3, fontWeight: 800 }}>{initials || name.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {COLOR_SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: value === c ? `3px solid ${DARK}` : '2px solid transparent', outline: value === c ? '2px solid #fff' : 'none', cursor: 'pointer', padding: 0 }} />
      ))}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>{children}</div>;
}

function Divider() { return <div style={{ height: 1, background: '#f0f0f0', margin: '24px 0' }} />; }

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p style={{ fontFamily: F.inter, fontSize: 13, color: PINK, background: '#fff0f8', border: `1px solid #fbc8e8`, borderRadius: 8, padding: '8px 12px', margin: '10px 0 0' }}>{msg}</p>;
}

function SuccessMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p style={{ fontFamily: F.inter, fontSize: 13, color: '#1a8a4a', background: '#edfff6', border: `1px solid #a3f0c8`, borderRadius: 8, padding: '8px 12px', margin: '10px 0 0' }}>{msg}</p>;
}

function Btn({ children, onClick, type = 'button', variant = 'primary', disabled, style }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'danger' | 'ghost'; disabled?: boolean; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = { fontFamily: F.inter, fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '8px 16px', transition: 'opacity .15s', opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: DARK, color: '#fff' },
    danger:  { background: PINK, color: '#fff' },
    ghost:   { background: 'transparent', color: '#808080', border: '1.5px solid #e5e5e5' },
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 800, color: DARK, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
      {action}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loading,          setLoading]          = useState(true);
  const [clients,          setClients]          = useState<Client[]>([]);
  const [search,           setSearch]           = useState('');
  const [selectedId,       setSelectedId]       = useState<string | 'new' | ''>('');
  const [clientData,       setClientData]       = useState<ClientData | null>(null);
  const [dataLoading,      setDataLoading]      = useState(false);
  const [activeTab,        setActiveTab]        = useState<Tab>('profile');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const passcode = sessionStorage.getItem('admin_passcode') ?? '';
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'X-Admin-Passcode': passcode, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<Record<string, unknown>>;
  }, []);

  const refreshClients = useCallback(async () => {
    const r = await api({ action: 'list_clients' });
    if (!r.error) setClients((r.data as Client[]) ?? []);
  }, [api]);

  useEffect(() => {
    api({ action: 'list_clients' }).then((r) => {
      if (!r.error) setClients((r.data as Client[]) ?? []);
      setLoading(false);
    });
  }, [api]);

  useEffect(() => {
    if (!selectedId || selectedId === 'new') { setClientData(null); return; }
    setDataLoading(true);
    api({ action: 'get_client_data', clientId: selectedId }).then((r) => {
      if (!r.error) setClientData(r.data as ClientData);
      setDataLoading(false);
    });
  }, [selectedId, api]);

  const refreshClientData = useCallback(async () => {
    if (!selectedId || selectedId === 'new') return;
    const r = await api({ action: 'get_client_data', clientId: selectedId });
    if (!r.error) setClientData(r.data as ClientData);
  }, [selectedId, api]);

  const filtered = clients.filter((c) =>
    `${c.full_name} ${c.company_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: Tab; label: string; count?: number }[] = clientData ? [
    { id: 'profile',    label: 'Profile' },
    { id: 'projects',   label: 'Projects',   count: clientData.projects.length },
    { id: 'invoices',   label: 'Invoices',   count: clientData.invoices.length },
    { id: 'requests',   label: 'Requests',   count: clientData.requests.length },
    { id: 'files',      label: 'Files',      count: clientData.files.length },
    { id: 'onboarding', label: 'Onboarding', count: clientData.onboarding.length },
    { id: 'milestones', label: 'Milestones', count: clientData.milestones.length },
    { id: 'activity',   label: 'Activity',   count: clientData.activity.length },
    { id: 'settings',   label: 'Settings' },
  ] : [{ id: 'settings' as Tab, label: 'Settings' }];

  const selectedClient = clients.find(c => c.id === selectedId);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.inter }}>
      <style>{`
        .admin-list-item:hover { background: #fafafa; }
        .admin-list-item.active { background: #fff0f8; }
        .admin-list-item.active .admin-list-name { color: ${PINK}; }
        .admin-sidebar {
          width: 260px; background: #fff; border-right: 1px solid #e5e5e5;
          display: flex; flex-direction: column; flex-shrink: 0;
        }
        .admin-mobile-bar { display: none; }
        .admin-client-hdr { padding: 24px 32px; }
        .admin-tab-bar { padding: 0 32px; }
        .admin-tab-content { padding: 24px 32px; }
        .admin-tab-inner { padding: 28px; border-radius: 12px; }
        @media (max-width: 640px) {
          .admin-sidebar {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
            width: 280px !important;
            transform: translateX(-100%);
            transition: transform .22s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,.15);
          }
          .admin-sidebar.mobile-open { transform: translateX(0); }
          .admin-mobile-bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e5e5e5; flex-shrink: 0; }
          .admin-client-hdr { padding: 16px !important; }
          .admin-tab-bar { padding: 0 16px !important; }
          .admin-tab-content { padding: 12px !important; }
          .admin-tab-inner { padding: 16px !important; border-radius: 8px; }
        }
      `}</style>

      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
        />
      )}

      {/* ── Left sidebar: client list ── */}
      <aside className={`admin-sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="6" cy="6" r="4.5" stroke="#bfbfbf" strokeWidth="1.5" />
              <path d="M10 10l2.5 2.5" stroke="#bfbfbf" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              style={{ ...INPUT, paddingLeft: 32, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '24px 16px', color: '#bfbfbf', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', color: '#bfbfbf', fontSize: 13 }}>No clients found</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className={`admin-list-item${selectedId === c.id ? ' active' : ''}`}
                onClick={() => { setSelectedId(c.id); setActiveTab('profile'); setMobileSidebarOpen(false); }}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderLeft: selectedId === c.id ? `3px solid ${PINK}` : '3px solid transparent', transition: 'background .15s' }}
              >
                <Avatar name={c.full_name} initials={c.initials} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div className="admin-list-name" style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color .15s' }}>{c.full_name}</div>
                  {c.company_name && <div style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</div>}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <button
            onClick={() => { setSelectedId('new'); setActiveTab('profile'); }}
            style={{ width: '100%', background: selectedId === 'new' ? PINK : DARK, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontFamily: F.inter, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background .15s' }}
          >
            + New Client
          </button>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f5f4', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile client selector bar */}
        <div className="admin-mobile-bar">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6f5f4', border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '8px 14px', fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: DARK, cursor: 'pointer', flex: 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="6" r="2.5" stroke="#808080" strokeWidth="1.5"/>
              <path d="M3 13c0-2.76 2.239-5 5-5s5 2.24 5 5" stroke="#808080" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {selectedClient ? selectedClient.full_name : selectedId === 'new' ? 'New Client' : 'Select Client'}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#808080" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => { setSelectedId('new'); setActiveTab('profile'); setMobileSidebarOpen(false); }}
            style={{ background: DARK, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: F.inter, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + New
          </button>
        </div>

        {/* No selection */}
        {!selectedId && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1.5px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="3.5" stroke="#bfbfbf" strokeWidth="1.5"/><path d="M4 18c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="#bfbfbf" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>Select a client to get started</p>
            <button onClick={() => setSelectedId('new')} style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: PINK, background: 'transparent', border: `1.5px solid ${PINK}`, borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>
              + Add first client
            </button>
          </div>
        )}

        {/* New client form */}
        {selectedId === 'new' && (
          <div className="admin-tab-content" style={{ maxWidth: 600 }}>
            <h2 style={{ fontFamily: F.inter, fontSize: 18, fontWeight: 800, color: DARK, margin: '0 0 6px' }}>New Client</h2>
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', margin: '0 0 28px' }}>Create a new client account. They'll receive a login invite.</p>
            <NewClientForm api={api} onCreated={(id) => { refreshClients(); setSelectedId(id); setActiveTab('profile'); }} />
          </div>
        )}

        {/* Client editor */}
        {selectedId && selectedId !== 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

            {/* Client header */}
            {clientData?.profile && (
              <div className="admin-client-hdr" style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar name={clientData.profile.full_name} initials={clientData.profile.initials} size={52} />
                    <div>
                      <div style={{ fontFamily: F.inter, fontSize: 20, fontWeight: 800, color: DARK, lineHeight: 1.2 }}>{clientData.profile.full_name}</div>
                      {clientData.profile.company_name && (
                        <div style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', marginTop: 2 }}>{clientData.profile.company_name}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    {/* Quick stats */}
                    {[
                      { label: 'Projects',   n: clientData.projects.length },
                      { label: 'Invoices',   n: clientData.invoices.length },
                      { label: 'Requests',   n: clientData.requests.length },
                    ].map(({ label, n }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: F.inter, fontSize: 22, fontWeight: 800, color: DARK, lineHeight: 1 }}>{n}</div>
                        <div style={{ fontFamily: F.inter, fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                    <Btn variant="danger" onClick={async () => {
                      if (!confirm(`Delete ${clientData.profile?.full_name} and all their data?`)) return;
                      await api({ action: 'delete_client', clientId: selectedId });
                      setSelectedId(''); refreshClients();
                    }}>Delete Client</Btn>
                  </div>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="admin-tab-bar" style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', display: 'flex', gap: 0, overflowX: 'auto' }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    fontFamily: F.inter, fontWeight: 600, fontSize: 13,
                    padding: '14px 16px', background: 'transparent', border: 'none',
                    borderBottom: activeTab === t.id ? `2px solid ${PINK}` : '2px solid transparent',
                    color: activeTab === t.id ? PINK : '#808080',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'color .15s',
                  }}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: activeTab === t.id ? '#fff0f8' : '#f1f0ef', color: activeTab === t.id ? PINK : '#808080', padding: '1px 7px', borderRadius: 999 }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="admin-tab-content" style={{ flex: 1 }}>
              {dataLoading ? (
                <div style={{ color: '#bfbfbf', fontSize: 13, fontFamily: F.inter }}>Loading…</div>
              ) : clientData ? (
                <div className="admin-tab-inner" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
                  {activeTab === 'profile'    && <ProfileTab    clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'projects'   && <ProjectsTab   clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'invoices'   && <InvoicesTab   clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'requests'   && <RequestsTab   clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'files'      && <FilesTab      clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'onboarding' && <OnboardingTab clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'milestones' && <MilestonesTab clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'activity'   && <ActivityTab   clientId={selectedId} data={clientData} api={api} onRefresh={refreshClientData} />}
                  {activeTab === 'settings'   && <SettingsTab   api={api} clientId={selectedId} clientEmail={clientData?.profile?.email ?? null} onRefresh={refreshClientData} />}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Client Form ────────────────────────────────────────────────────────────
function NewClientForm({ api, onCreated }: { api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onCreated: (id: string) => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName) { setError('Email and full name are required'); return; }
    setSaving(true); setError('');
    const r = await api({ action: 'create_client', email, full_name: fullName, company_name: companyName }) as { ok?: boolean; data?: { id: string }; error?: string };
    if (r.error) { setError(r.error); setSaving(false); return; }
    onCreated(r.data!.id);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <FormGrid>
        <FormRow label="Email *"><input style={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" /></FormRow>
        <FormRow label="Full Name *"><input style={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" /></FormRow>
        <FormRow label="Company"><input style={INPUT} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." /></FormRow>
      </FormGrid>
      <div>
        <Btn type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Client'}</Btn>
        <ErrorMsg msg={error} />
      </div>
    </form>
  );
}

// ── Profile Tab ────────────────────────────────────────────────────────────────
function ProfileTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const p = data.profile;
  const [fullName, setFullName] = useState(p?.full_name ?? '');
  const [companyName, setCompanyName] = useState(p?.company_name ?? '');
  const [initials, setInitials] = useState(p?.initials ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    const r = await api({ action: 'update_profile', clientId, full_name: fullName, company_name: companyName, initials }) as { ok?: boolean; error?: string };
    if (r.error) setError(r.error); else { setSuccess('Saved.'); onRefresh(); }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormGrid>
        <FormRow label="Full Name"><input style={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)} /></FormRow>
        <FormRow label="Company"><input style={INPUT} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></FormRow>
        <FormRow label="Initials"><input style={INPUT} value={initials} onChange={(e) => setInitials(e.target.value)} maxLength={3} /></FormRow>
      </FormGrid>
      <div>
        <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
        <ErrorMsg msg={error} /><SuccessMsg msg={success} />
      </div>
    </form>
  );
}

// ── Projects Tab ───────────────────────────────────────────────────────────────
function ProjectsTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('kickoff');
  const [progress, setProgress] = useState(0);
  const [color, setColor] = useState(PINK);
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return;
    await api({ action: 'delete_project', id });
    onRefresh();
  }

  async function handleEditSave(id: string) {
    setSaving(true);
    await api({ action: 'update_project', id, ...editData });
    setEditId(null); setEditData({}); setSaving(false); onRefresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name) { setAddErr('Name required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_project', clientId, name, status, progress, color }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setName(''); setStatus('kickoff'); setProgress(0); setColor(PINK); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead title="Projects" action={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Project'}</Btn>} />

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="Name *"><input style={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand Identity" /></FormRow>
              <FormRow label="Status">
                <select style={SELECT} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="kickoff">Kickoff</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option>
                </select>
              </FormRow>
              <FormRow label="Progress (0–100)"><input style={INPUT} type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></FormRow>
            </FormGrid>
            <FormRow label="Color"><ColorPicker value={color} onChange={setColor} /></FormRow>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add Project'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.projects.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: '8px 0' }}>No projects yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.projects.map((p, i) => (
            <div key={p.id} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0', marginBottom: i < data.projects.length - 1 ? 8 : 0 }}>
              {editId === p.id ? (
                <div style={{ padding: 16, background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FormGrid>
                    <FormRow label="Name"><input style={INPUT} value={editData.name ?? p.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} /></FormRow>
                    <FormRow label="Status">
                      <select style={SELECT} value={editData.status ?? p.status} onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}>
                        <option value="kickoff">Kickoff</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option>
                      </select>
                    </FormRow>
                    <FormRow label="Progress"><input style={INPUT} type="number" min={0} max={100} value={editData.progress ?? p.progress} onChange={(e) => setEditData((d) => ({ ...d, progress: Number(e.target.value) }))} /></FormRow>
                  </FormGrid>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => handleEditSave(p.id)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
                    <Btn variant="ghost" onClick={() => { setEditId(null); setEditData({}); }}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: DARK }}>{p.name}</div>
                    <div style={{ marginTop: 6, background: '#f0f0f0', borderRadius: 999, height: 4, width: '100%', maxWidth: 200 }}>
                      <div style={{ height: 4, borderRadius: 999, background: p.color, width: `${p.progress}%`, transition: 'width .3s' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge status={p.status} />
                    <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', minWidth: 32 }}>{p.progress}%</span>
                    <Btn variant="ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => { setEditId(p.id); setEditData({}); }}>Edit</Btn>
                    <Btn variant="danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => handleDelete(p.id)}>Delete</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────────────────────
function InvoicesTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Invoice>>({});
  const [saving, setSaving] = useState(false);
  const [invNum, setInvNum] = useState('');
  const [projName, setProjName] = useState('');
  const [amountDol, setAmountDol] = useState('');
  const [invDate, setInvDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invStatus, setInvStatus] = useState('due');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm('Delete invoice?')) return;
    await api({ action: 'delete_invoice', id }); onRefresh();
  }

  async function handleEditSave(id: string) {
    setSaving(true);
    const payload = { ...editData, amount_cents: editData.amount_cents !== undefined ? Number(editData.amount_cents) : undefined };
    await api({ action: 'update_invoice', id, ...payload });
    setEditId(null); setEditData({}); setSaving(false); onRefresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!invNum || !amountDol) { setAddErr('Invoice # and Amount required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_invoice', clientId, invoice_number: invNum, project_name: projName, amount_cents: Math.round(parseFloat(amountDol) * 100), invoice_date: invDate, due_date: dueDate, status: invStatus }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setInvNum(''); setProjName(''); setAmountDol(''); setInvDate(''); setDueDate(''); setInvStatus('due'); setShowForm(false);
    setAdding(false); onRefresh();
  }

  const total = data.invoices.reduce((s, i) => s + i.amount_cents, 0);
  const paid  = data.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_cents, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Billed</div>
            <div style={{ fontFamily: F.inter, fontSize: 20, fontWeight: 800, color: DARK }}>{fmtAmount(total)}</div>
          </div>
          <div>
            <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paid</div>
            <div style={{ fontFamily: F.inter, fontSize: 20, fontWeight: 800, color: '#1a8a4a' }}>{fmtAmount(paid)}</div>
          </div>
        </div>
        <Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Invoice'}</Btn>
      </div>

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="Invoice # *"><input style={INPUT} value={invNum} onChange={(e) => setInvNum(e.target.value)} placeholder="INV-001" /></FormRow>
              <FormRow label="Project"><input style={INPUT} value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Brand Identity" /></FormRow>
              <FormRow label="Amount (USD) *"><input style={INPUT} type="number" step="0.01" value={amountDol} onChange={(e) => setAmountDol(e.target.value)} placeholder="1200.00" /></FormRow>
              <FormRow label="Invoice Date"><input style={INPUT} type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} /></FormRow>
              <FormRow label="Due Date"><input style={INPUT} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></FormRow>
              <FormRow label="Status"><select style={SELECT} value={invStatus} onChange={(e) => setInvStatus(e.target.value)}><option value="due">Due</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></FormRow>
            </FormGrid>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add Invoice'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.invoices.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No invoices yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.inter, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                {['Invoice #', 'Project', 'Amount', 'Invoice Date', 'Due', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#bfbfbf', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => editId === inv.id ? (
                <tr key={inv.id} style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 12px' }}><input style={{ ...INPUT, width: 100 }} value={editData.invoice_number ?? inv.invoice_number} onChange={(e) => setEditData((d) => ({ ...d, invoice_number: e.target.value }))} /></td>
                  <td style={{ padding: '10px 12px' }}><input style={{ ...INPUT, width: 130 }} value={editData.project_name ?? inv.project_name} onChange={(e) => setEditData((d) => ({ ...d, project_name: e.target.value }))} /></td>
                  <td style={{ padding: '10px 12px' }}><input style={{ ...INPUT, width: 90 }} type="number" value={editData.amount_cents !== undefined ? editData.amount_cents / 100 : inv.amount_cents / 100} onChange={(e) => setEditData((d) => ({ ...d, amount_cents: parseFloat(e.target.value) * 100 }))} /></td>
                  <td style={{ padding: '10px 12px', color: '#808080', fontSize: 12 }}>{fmtDate(inv.invoice_date)}</td>
                  <td style={{ padding: '10px 12px' }}><input style={{ ...INPUT, width: 130 }} type="date" value={editData.due_date ?? inv.due_date} onChange={(e) => setEditData((d) => ({ ...d, due_date: e.target.value }))} /></td>
                  <td style={{ padding: '10px 12px' }}><select style={{ ...SELECT, width: 110 }} value={editData.status ?? inv.status} onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}><option value="due">Due</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></td>
                  <td style={{ padding: '10px 12px' }}><div style={{ display: 'flex', gap: 6 }}><Btn onClick={() => handleEditSave(inv.id)} disabled={saving} style={{ padding: '5px 12px', fontSize: 12 }}>{saving ? '…' : 'Save'}</Btn><Btn variant="ghost" onClick={() => { setEditId(null); setEditData({}); }} style={{ padding: '5px 12px', fontSize: 12 }}>✕</Btn></div></td>
                </tr>
              ) : (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 12px', fontWeight: 700, color: DARK }}>{inv.invoice_number}</td>
                  <td style={{ padding: '12px 12px', color: '#808080' }}>{inv.project_name || '—'}</td>
                  <td style={{ padding: '12px 12px', fontWeight: 700, color: DARK }}>{fmtAmount(inv.amount_cents)}</td>
                  <td style={{ padding: '12px 12px', color: '#808080', fontSize: 12 }}>{fmtDate(inv.invoice_date)}</td>
                  <td style={{ padding: '12px 12px', color: '#808080', fontSize: 12 }}>{fmtDate(inv.due_date)}</td>
                  <td style={{ padding: '12px 12px' }}><Badge status={inv.status} /></td>
                  <td style={{ padding: '12px 12px' }}><div style={{ display: 'flex', gap: 6 }}><Btn variant="ghost" onClick={() => { setEditId(inv.id); setEditData({}); }} style={{ padding: '5px 12px', fontSize: 12 }}>Edit</Btn><Btn variant="danger" onClick={() => handleDelete(inv.id)} style={{ padding: '5px 12px', fontSize: 12 }}>Delete</Btn></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Requests Tab ───────────────────────────────────────────────────────────────
function RequestsTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('kickoff');
  const [priority, setPriority] = useState('normal');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const PRIORITY: Record<string, { color: string; bg: string }> = { high: { color: PINK, bg: '#fff0f8' }, normal: { color: BLUE, bg: '#eef1ff' }, low: { color: '#808080', bg: '#f1f0ef' } };

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title) { setAddErr('Title required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_request', clientId, title, type, status, priority }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setTitle(''); setType(''); setStatus('kickoff'); setPriority('normal'); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead title="Requests" action={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Request'}</Btn>} />

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="Title *"><input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Logo revision" /></FormRow>
              <FormRow label="Type"><input style={INPUT} value={type} onChange={(e) => setType(e.target.value)} placeholder="Design, Copy…" /></FormRow>
              <FormRow label="Status"><select style={SELECT} value={status} onChange={(e) => setStatus(e.target.value)}><option value="kickoff">Kickoff</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option></select></FormRow>
              <FormRow label="Priority"><select style={SELECT} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></FormRow>
            </FormGrid>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add Request'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.requests.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No requests yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.requests.map((req) => {
            const pr = PRIORITY[req.priority] ?? PRIORITY.normal;
            return (
              <div key={req.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, background: pr.bg, color: pr.color, padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{req.priority}</span>
                  <div>
                    <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: DARK }}>{req.title}</span>
                    {req.type && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginLeft: 8 }}>{req.type}</span>}
                  </div>
                  <Badge status={req.status} />
                </div>
                <Btn variant="danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={async () => { if (!confirm('Delete?')) return; await api({ action: 'delete_request', id: req.id }); onRefresh(); }}>Delete</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Files Tab ──────────────────────────────────────────────────────────────────
function FilesTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [projName, setProjName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !fileUrl) { setAddErr('Name and URL required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_file', clientId, name, project_name: projName, file_url: fileUrl }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setName(''); setProjName(''); setFileUrl(''); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead title="Files & Assets" action={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add File'}</Btn>} />

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="File Name *"><input style={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="brand-guide.pdf" /></FormRow>
              <FormRow label="Project"><input style={INPUT} value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Brand Identity" /></FormRow>
            </FormGrid>
            <FormRow label="File URL *"><input style={INPUT} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" /></FormRow>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add File'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.files.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No files yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.files.map((f) => (
            <div key={f.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f0ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#808080" strokeWidth="1.2"/><path d="M10 2v3h3" stroke="#808080" strokeWidth="1.2"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: DARK }}>{f.name}</div>
                  <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>{f.project_name || ''}</div>
                </div>
                {f.file_url && <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.inter, fontSize: 12, color: BLUE }}>↗ Open</a>}
              </div>
              <Btn variant="danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={async () => { if (!confirm('Delete?')) return; await api({ action: 'delete_file', id: f.id }); onRefresh(); }}>Delete</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onboarding Tab ─────────────────────────────────────────────────────────────
function OnboardingTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [stepNum, setStepNum] = useState(data.onboarding.length + 1);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [actLabel, setActLabel] = useState('');
  const [actHref, setActHref] = useState('');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const done = data.onboarding.filter((s) => s.completed).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title) { setAddErr('Title required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_onboarding_step', clientId, step_number: stepNum, title, description: desc, action_label: actLabel, action_href: actHref }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setStepNum((n) => n + 1); setTitle(''); setDesc(''); setActLabel(''); setActHref(''); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 800, color: DARK, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Onboarding</h3>
          {data.onboarding.length > 0 && (
            <div style={{ fontFamily: F.inter, fontSize: 12, color: '#808080' }}>{done} of {data.onboarding.length} completed</div>
          )}
        </div>
        <Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Step'}</Btn>
      </div>

      {data.onboarding.length > 0 && (
        <div style={{ background: '#f0f0f0', borderRadius: 999, height: 6, marginBottom: 20 }}>
          <div style={{ height: 6, borderRadius: 999, background: GREEN, width: `${data.onboarding.length ? (done / data.onboarding.length) * 100 : 0}%`, transition: 'width .4s' }} />
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="Step # *"><input style={INPUT} type="number" min={1} value={stepNum} onChange={(e) => setStepNum(Number(e.target.value))} /></FormRow>
              <FormRow label="Title *"><input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sign Contract" /></FormRow>
            </FormGrid>
            <FormRow label="Description"><input style={INPUT} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Please review and sign…" /></FormRow>
            <FormGrid>
              <FormRow label="Action Label"><input style={INPUT} value={actLabel} onChange={(e) => setActLabel(e.target.value)} placeholder="Sign Now" /></FormRow>
              <FormRow label="Action URL"><input style={INPUT} value={actHref} onChange={(e) => setActHref(e.target.value)} placeholder="/portal/files" /></FormRow>
            </FormGrid>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add Step'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.onboarding.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No steps yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.onboarding.map((step) => (
            <div key={step.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input type="checkbox" checked={step.completed} onChange={() => { api({ action: 'toggle_onboarding', id: step.id, completed: !step.completed }); onRefresh(); }}
                style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: GREEN }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#bfbfbf' }}>STEP {step.step_number}</span>
                  <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: step.completed ? '#bfbfbf' : DARK, textDecoration: step.completed ? 'line-through' : 'none' }}>{step.title}</span>
                  {step.completed && <span style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#1a8a4a', background: '#edfff6', padding: '2px 8px', borderRadius: 999 }}>Done</span>}
                </div>
                {step.description && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', margin: '4px 0 0' }}>{step.description}</p>}
                {step.action_label && <span style={{ fontFamily: F.inter, fontSize: 12, color: BLUE, marginTop: 4, display: 'inline-block' }}>{step.action_label} → {step.action_href}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Milestones Tab ─────────────────────────────────────────────────────────────
function MilestonesTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [projName, setProjName] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [color, setColor] = useState(PINK);
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title) { setAddErr('Title required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_milestone', clientId, project_name: projName, title, due_date: dueDate, color }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setProjName(''); setTitle(''); setDueDate(''); setColor(PINK); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead title="Milestones" action={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Milestone'}</Btn>} />

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormGrid>
              <FormRow label="Title *"><input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Final Delivery" /></FormRow>
              <FormRow label="Project"><input style={INPUT} value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Brand Identity" /></FormRow>
              <FormRow label="Due Date"><input style={INPUT} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></FormRow>
            </FormGrid>
            <FormRow label="Color"><ColorPicker value={color} onChange={setColor} /></FormRow>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add Milestone'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.milestones.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No milestones yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.milestones.map((m) => (
            <div key={m.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={m.completed} onChange={() => { api({ action: 'update_milestone', id: m.id, title: m.title, due_date: m.due_date, completed: !m.completed }); onRefresh(); }}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: GREEN }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <div>
                  <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: m.completed ? '#bfbfbf' : DARK, textDecoration: m.completed ? 'line-through' : 'none' }}>{m.title}</span>
                  {m.project_name && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', marginLeft: 8 }}>{m.project_name}</span>}
                </div>
                {m.due_date && <span style={{ fontFamily: F.inter, fontSize: 12, color: '#808080', background: '#f1f0ef', padding: '2px 8px', borderRadius: 999 }}>{fmtDate(m.due_date)}</span>}
              </div>
              <Btn variant="danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={async () => { if (!confirm('Delete?')) return; await api({ action: 'delete_milestone', id: m.id }); onRefresh(); }}>Delete</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ───────────────────────────────────────────────────────────────
function ActivityTab({ clientId, data, api, onRefresh }: { clientId: string; data: ClientData; api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>; onRefresh: () => void }) {
  const [text, setText] = useState('');
  const [dotColor, setDotColor] = useState(GREEN);
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text) { setAddErr('Text required'); return; }
    setAdding(true); setAddErr('');
    const r = await api({ action: 'add_activity', clientId, text, dot_color: dotColor }) as { error?: string };
    if (r.error) { setAddErr(r.error); setAdding(false); return; }
    setText(''); setDotColor(GREEN); setShowForm(false);
    setAdding(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead title="Activity Feed" action={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Activity'}</Btn>} />

      {showForm && (
        <div style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e5e5e5', padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormRow label="Activity Text *"><input style={INPUT} value={text} onChange={(e) => setText(e.target.value)} placeholder="Invoice #005 sent to client" /></FormRow>
            <FormRow label="Dot Color"><ColorPicker value={dotColor} onChange={setDotColor} /></FormRow>
            <div><Btn type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add'}</Btn><ErrorMsg msg={addErr} /></div>
          </form>
        </div>
      )}

      {data.activity.length === 0 ? (
        <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf' }}>No activity yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.activity.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: i < data.activity.length - 1 ? 16 : 0, marginBottom: i < data.activity.length - 1 ? 16 : 0, borderBottom: i < data.activity.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.dot_color, flexShrink: 0, marginTop: 4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: F.inter, fontSize: 14, color: DARK }}>{item.text}</span>
                <span style={{ fontFamily: F.inter, fontSize: 12, color: '#bfbfbf', marginLeft: 10 }}>{relTime(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────
const DEMO_EMAIL = 'lauren@thrivecreativestudios.org';

function SettingsTab({ api, clientId, clientEmail, onRefresh }: {
  api: (b: Record<string, unknown>) => Promise<Record<string, unknown>>;
  clientId: string;
  clientEmail: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [demoConfirm, setDemoConfirm] = useState(false);
  const [demoRemoving, setDemoRemoving] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoSuccess, setDemoSuccess] = useState('');

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 4) { setError('Must be at least 4 characters'); return; }
    if (newPass !== confirm) { setError('Passcodes do not match'); return; }
    setSaving(true); setError(''); setSuccess('');
    const r = await api({ action: 'change_passcode', new_passcode: newPass }) as { ok?: boolean; error?: string };
    if (r.error) { setError(r.error); setSaving(false); return; }
    sessionStorage.setItem('admin_passcode', newPass);
    setSuccess('Passcode updated. Use the new passcode next time you sign in.');
    setNewPass(''); setConfirm(''); setSaving(false);
  }

  async function handleRemoveDemo() {
    setDemoRemoving(true); setDemoError(''); setDemoSuccess('');
    const r = await api({ action: 'remove_demo_data', clientId }) as { ok?: boolean; error?: string };
    if (r.error) { setDemoError(r.error); setDemoRemoving(false); return; }
    setDemoSuccess('Demo data removed. The portal is now clean.');
    setDemoConfirm(false); setDemoRemoving(false);
    await onRefresh();
  }

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* Passcode */}
      <div>
        <h3 style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 800, color: DARK, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change Admin Passcode</h3>
        <p style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', margin: '0 0 24px', lineHeight: 1.6 }}>Must be at least 4 characters. Stored securely in your database.</p>
        <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow label="New Passcode"><input style={INPUT} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Enter new passcode" /></FormRow>
          <FormRow label="Confirm Passcode"><input style={INPUT} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new passcode" /></FormRow>
          <div>
            <Btn type="submit" disabled={saving || !newPass || !confirm}>{saving ? 'Saving…' : 'Update Passcode'}</Btn>
            <ErrorMsg msg={error} /><SuccessMsg msg={success} />
          </div>
        </form>
      </div>

      {/* Demo data — only visible for the demo account */}
      {clientEmail === DEMO_EMAIL && (
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 32 }}>
          <h3 style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 800, color: PINK, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remove Demo Data</h3>
          <p style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', margin: '0 0 20px', lineHeight: 1.6 }}>
            Permanently deletes all projects, invoices, requests, files, milestones, onboarding steps, and activity for this account. The account itself is kept. This cannot be undone.
          </p>
          {!demoConfirm ? (
            <Btn variant="danger" onClick={() => setDemoConfirm(true)}>Remove Demo Data</Btn>
          ) : (
            <div style={{ background: '#fff0f8', border: `1px solid ${PINK}`, borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: PINK, margin: 0 }}>Are you sure? This will wipe all portal data for this client.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="danger" disabled={demoRemoving} onClick={handleRemoveDemo}>{demoRemoving ? 'Removing…' : 'Yes, remove it all'}</Btn>
                <Btn variant="ghost" onClick={() => setDemoConfirm(false)}>Cancel</Btn>
              </div>
            </div>
          )}
          <ErrorMsg msg={demoError} />
          <SuccessMsg msg={demoSuccess} />
        </div>
      )}
    </div>
  );
}

// ── Shared divider (used only if needed) ──────────────────────────────────────
function _Divider() { return <Divider />; }
void _Divider;
