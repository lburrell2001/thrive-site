'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter), 'Inter', sans-serif`,
};

const SERVICES = [
  { slug: 'branding',       label: 'Branding',       accent: '#fd6100', coverKey: 'brand-design',   staticFallback: '/new-thrive/services/brand-design.jpg' },
  { slug: 'digital-design', label: 'Digital Design', accent: '#1e3add', coverKey: 'digital-design', staticFallback: '/new-thrive/services/digital-design.jpg' },
  { slug: 'ux-design',      label: 'UX Design',      accent: '#5b2d8e', coverKey: 'ux-design',      staticFallback: '/new-thrive/services/ux.png' },
  { slug: 'social-media',   label: 'Social Media',   accent: '#e50586', coverKey: 'social-media',   staticFallback: '/new-thrive/services/social-media.png' },
  { slug: 'photography',    label: 'Photography',    accent: '#0cf574', coverKey: 'photography',    staticFallback: '/new-thrive/services/photo.png' },
];

type Project = { id: string; title: string; slug: string; category: string | null };

function getPasscode() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('admin_passcode') ?? '' : '';
}

async function apiFetch(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'X-Admin-Passcode': getPasscode(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json() as { ok?: boolean; error?: string; data?: unknown; url?: string; signedUrl?: string; path?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed');
  return data;
}

async function directUpload(file: File, storagePath: string, upsert = false): Promise<string> {
  const res = await apiFetch('create_upload_url', { path: storagePath, upsert });
  if (!res.signedUrl) throw new Error('Could not get upload URL');
  const up = await fetch(res.signedUrl as string, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!up.ok) throw new Error(`Storage upload failed (${up.status})`);
  return (res.path as string) ?? storagePath;
}

function storageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-media/${path}`;
}

export default function ServicesAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeServiceTab, setActiveServiceTab] = useState(SERVICES[0].slug);

  // Cover upload state
  const [uploading, setUploading] = useState<string | null>(null);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(SERVICES.map(s => [s.slug, storageUrl(`services/${s.coverKey}-cover.jpg`)]))
  );
  const [coverMsgs, setCoverMsgs] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Featured projects state — selections[serviceSlug] = array of project slugs (in order)
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(SERVICES.map(s => [s.slug, new Set<string>()]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [featuredMsgs, setFeaturedMsgs] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({});

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await apiFetch('list_portfolio_projects');
      setProjects((res.data as Project[]) ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadFeatured = useCallback(async (serviceSlug: string) => {
    try {
      const res = await apiFetch('list_service_featured', { serviceSlug });
      const rows = (res.data as { project_slug: string }[]) ?? [];
      setSelections(prev => ({
        ...prev,
        [serviceSlug]: new Set(rows.map(r => r.project_slug)),
      }));
    } catch (e) {
      console.error('Failed to load featured for', serviceSlug, e);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Load featured for each service tab on first visit
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!loadedTabs.has(activeServiceTab)) {
      setLoadedTabs(prev => new Set([...prev, activeServiceTab]));
      loadFeatured(activeServiceTab);
    }
  }, [activeServiceTab, loadedTabs, loadFeatured]);

  function setCoverMsg(slug: string, type: 'ok' | 'err', text: string) {
    setCoverMsgs(prev => ({ ...prev, [slug]: { type, text } }));
    if (type === 'ok') setTimeout(() => setCoverMsgs(prev => { const n = { ...prev }; delete n[slug]; return n; }), 4000);
  }

  function setFeaturedMsg(slug: string, type: 'ok' | 'err', text: string) {
    setFeaturedMsgs(prev => ({ ...prev, [slug]: { type, text } }));
    if (type === 'ok') setTimeout(() => setFeaturedMsgs(prev => { const n = { ...prev }; delete n[slug]; return n; }), 4000);
  }

  async function handleCoverUpload(svc: typeof SERVICES[0], e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(svc.slug);
    setCoverMsgs(prev => { const n = { ...prev }; delete n[svc.slug]; return n; });
    try {
      const path = await directUpload(file, `services/${svc.coverKey}-cover.jpg`, true);
      const res = await apiFetch('upload_service_cover', { slug: svc.coverKey, path });
      setCoverUrls(prev => ({ ...prev, [svc.slug]: (res.url as string) + '?t=' + Date.now() }));
      setCoverMsg(svc.slug, 'ok', 'Cover image updated.');
    } catch (err) {
      setCoverMsg(svc.slug, 'err', (err as Error).message);
    } finally {
      setUploading(null);
      if (inputRefs.current[svc.slug]) inputRefs.current[svc.slug]!.value = '';
    }
  }

  function toggleProject(serviceSlug: string, projectSlug: string) {
    setSelections(prev => {
      const next = new Set(prev[serviceSlug]);
      if (next.has(projectSlug)) next.delete(projectSlug);
      else next.add(projectSlug);
      return { ...prev, [serviceSlug]: next };
    });
  }

  async function saveFeatured(serviceSlug: string) {
    setSaving(serviceSlug);
    setFeaturedMsgs(prev => { const n = { ...prev }; delete n[serviceSlug]; return n; });
    try {
      const projectSlugs = Array.from(selections[serviceSlug]);
      await apiFetch('set_service_featured', { serviceSlug, projectSlugs });
      // Re-fetch to confirm what persisted
      await loadFeatured(serviceSlug);
      setFeaturedMsg(serviceSlug, 'ok', `Saved — ${projectSlugs.length} project${projectSlugs.length !== 1 ? 's' : ''} featured.`);
    } catch (err) {
      setFeaturedMsg(serviceSlug, 'err', `Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  const activeService = SERVICES.find(s => s.slug === activeServiceTab)!;

  return (
    <div style={{ padding: '32px 40px 60px', overflowY: 'auto', height: '100%', background: '#0f0f0f', boxSizing: 'border-box' }}>
      <style>{`
        @media (max-width: 640px) {
          .svc-admin-wrap { padding: 20px 16px 40px !important; }
          .svc-cover-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="svc-admin-wrap" style={{ maxWidth: 980 }}>
        <h1 style={{ fontFamily: F.bungee, fontSize: 22, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          SERVICES
        </h1>
        <p style={{ fontFamily: F.inter, fontSize: 13, color: '#555', margin: '0 0 40px' }}>
          Manage cover images and featured projects for each service page.
        </p>

        {/* ── COVER IMAGES ── */}
        <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e50586', borderBottom: '1px solid #2a2a2a', paddingBottom: 8, marginBottom: 24 }}>
          Cover Images
        </div>
        <p style={{ fontFamily: F.inter, fontSize: 13, color: '#555', margin: '0 0 20px' }}>
          Used as the hero background on each service page. Recommended: 1600 × 1000px · JPG / PNG / WebP · Max 5 MB.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginBottom: 56 }}>
          {SERVICES.map(svc => {
            const isUploading = uploading === svc.slug;
            const msg = coverMsgs[svc.slug];
            return (
              <div key={svc.slug} style={{ background: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
                <div style={{ height: 3, background: svc.accent }} />
                <div style={{ position: 'relative', height: 160, background: '#111', overflow: 'hidden' }}>
                  <img
                    src={coverUrls[svc.slug]}
                    alt={svc.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (img.src !== svc.staticFallback) img.src = svc.staticFallback;
                    }}
                  />
                  {isUploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: F.inter, fontSize: 13, color: '#fff', fontWeight: 600 }}>Uploading…</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 18px 18px' }}>
                  <div style={{ fontFamily: F.bungee, fontSize: 13, color: '#fff', letterSpacing: '-0.01em', marginBottom: 12 }}>{svc.label}</div>
                  <input ref={el => { inputRefs.current[svc.slug] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(svc, e)} />
                  <button
                    onClick={() => inputRefs.current[svc.slug]?.click()}
                    disabled={isUploading}
                    style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 700, color: isUploading ? '#555' : '#fff', background: isUploading ? '#222' : svc.accent + '22', border: `1.5px solid ${isUploading ? '#333' : svc.accent}`, borderRadius: 7, padding: '7px 16px', cursor: isUploading ? 'default' : 'pointer' }}
                  >
                    {isUploading ? 'Uploading…' : 'Upload Cover'}
                  </button>
                  {msg && <p style={{ fontFamily: F.inter, fontSize: 12, margin: '8px 0 0', color: msg.type === 'ok' ? '#0cf574' : '#e50586' }}>{msg.text}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FEATURED PROJECTS ── */}
        <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e50586', borderBottom: '1px solid #2a2a2a', paddingBottom: 8, marginBottom: 24 }}>
          Featured Projects
        </div>
        <p style={{ fontFamily: F.inter, fontSize: 13, color: '#555', margin: '0 0 20px' }}>
          Choose which portfolio projects appear in the featured section on each service page.
        </p>

        {/* Service tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
          {SERVICES.map(svc => (
            <button
              key={svc.slug}
              onClick={() => setActiveServiceTab(svc.slug)}
              style={{
                fontFamily: F.inter, fontSize: 12, fontWeight: 700,
                padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeServiceTab === svc.slug ? svc.accent : '#1a1a1a',
                color: activeServiceTab === svc.slug ? '#fff' : '#666',
                transition: 'all .15s',
              }}
            >
              {svc.label}
            </button>
          ))}
        </div>

        {/* Project checklist */}
        <div style={{ background: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #2a2a2a', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: F.bungee, fontSize: 13, color: '#fff', letterSpacing: '-0.01em' }}>
              {activeService.label} — Featured Projects
            </span>
            <span style={{ fontFamily: F.inter, fontSize: 11, color: '#555' }}>
              {selections[activeServiceTab].size} selected
            </span>
          </div>

          {projectsLoading ? (
            <div style={{ padding: '32px 20px', fontFamily: F.inter, fontSize: 13, color: '#555' }}>Loading projects…</div>
          ) : projects.length === 0 ? (
            <div style={{ padding: '32px 20px', fontFamily: F.inter, fontSize: 13, color: '#555' }}>No portfolio projects yet.</div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {projects.map(proj => {
                const isChecked = selections[activeServiceTab].has(proj.slug);
                return (
                  <label
                    key={proj.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 20px', cursor: 'pointer',
                      borderBottom: '1px solid #222',
                      background: isChecked ? activeService.accent + '12' : 'transparent',
                      transition: 'background .1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleProject(activeServiceTab, proj.slug)}
                      style={{ width: 16, height: 16, accentColor: activeService.accent, cursor: 'pointer', flexShrink: 0 }}
                    />
                    {/* Cover thumbnail */}
                    <img
                      src={storageUrl(`projects/${proj.slug}/cover.jpg`)}
                      alt={proj.title}
                      style={{ width: 48, height: 34, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#222' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: isChecked ? '#fff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proj.title}
                      </div>
                      {proj.category && (
                        <div style={{ fontFamily: F.inter, fontSize: 11, color: '#555', marginTop: 2 }}>{proj.category}</div>
                      )}
                    </div>
                    {isChecked && (
                      <div style={{ marginLeft: 'auto', flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: activeService.accent }} />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ padding: '14px 20px', borderTop: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => saveFeatured(activeServiceTab)}
              disabled={!!saving}
              style={{
                fontFamily: F.inter, fontSize: 13, fontWeight: 700,
                color: '#fff', background: saving ? '#333' : activeService.accent,
                border: 'none', borderRadius: 8, padding: '9px 22px',
                cursor: saving ? 'default' : 'pointer', transition: 'background .15s',
              }}
            >
              {saving === activeServiceTab ? 'Saving…' : 'Save Featured Projects'}
            </button>
            {featuredMsgs[activeServiceTab] && (
              <span style={{ fontFamily: F.inter, fontSize: 13, color: featuredMsgs[activeServiceTab].type === 'ok' ? '#0cf574' : '#e50586' }}>
                {featuredMsgs[activeServiceTab].text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
