'use client';

// Services: each service page's cover image and featured projects.

import { useState, useRef, useEffect, useCallback } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { adminHeaders } from '@/lib/adminSession';


const SERVICES = [
  { slug: 'branding',       label: 'Branding',       accent: '#fd6100', coverKey: 'brand-design',   staticFallback: '/new-thrive/services/brand-design.webp' },
  { slug: 'digital-design', label: 'Web design & development', accent: '#3943b7', coverKey: 'digital-design', staticFallback: '/new-thrive/services/web-development.webp' },
  { slug: 'ux-design',      label: 'UX design',      accent: '#9409ce', coverKey: 'ux-design',      staticFallback: '/new-thrive/services/ux.webp' },
  { slug: 'social-media',   label: 'Social media',   accent: '#e50586', coverKey: 'social-media',   staticFallback: '/new-thrive/services/social-media.webp' },
  { slug: 'photography',    label: 'Photography',    accent: '#0cf574', coverKey: 'photography',    staticFallback: '/new-thrive/services/photo.webp' },
];

type Project = { id: string; title: string; slug: string; category: string | null };

async function apiFetch(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
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
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Services</h1>
          <p className={w.sub}>The cover image and featured projects on each service page. Prices and copy live in the code (servicePricing.ts, serviceSeo.ts).</p>
        </div>
      </div>

      <section className={w.card} style={{ marginBottom: 18 }}>
        <div className={w.cardHead}>
          <h2 className={w.cardTitle}>Cover images</h2>
          <span className={w.muted} style={{ fontSize: 12.5 }}>The hero background on each page · 1600 × 1000 px · JPG, PNG or WebP · up to 5 MB</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, padding: 18 }}>
          {SERVICES.map(svc => {
            const isUploading = uploading === svc.slug;
            const msg = coverMsgs[svc.slug];
            return (
              <div key={svc.slug} style={{ border: '1px solid var(--a-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--a-surface)' }}>
                <div style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--a-bg)', overflow: 'hidden', borderBottom: `3px solid ${svc.accent}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>Uploading…</div>
                  )}
                </div>
                <div style={{ padding: '12px 14px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14, flex: 1 }}>{svc.label}</strong>
                  <input ref={el => { inputRefs.current[svc.slug] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(svc, e)} />
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => inputRefs.current[svc.slug]?.click()} disabled={isUploading}>
                    {isUploading ? 'Uploading…' : 'Replace'}
                  </button>
                  {msg && <p style={{ flexBasis: '100%', fontSize: 12, margin: 0, color: msg.type === 'ok' ? '#141414' : 'var(--a-danger)' }}>{msg.text}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={w.card}>
        <div className={w.cardHead}>
          <h2 className={w.cardTitle}>Featured projects</h2>
          <span className={w.muted} style={{ fontSize: 12.5 }}>Which portfolio projects show on each service page</span>
          <span className={w.cardCount} style={{ marginLeft: 'auto' }}>{selections[activeServiceTab].size} selected</span>
        </div>

        <div style={{ padding: '14px 18px 0' }}>
          <div className={w.chips} role="group" aria-label="Service">
            {SERVICES.map(svc => (
              <button key={svc.slug} type="button" aria-pressed={activeServiceTab === svc.slug}
                className={`${w.chip} ${activeServiceTab === svc.slug ? w.chipOn : ''}`} onClick={() => setActiveServiceTab(svc.slug)}>
                {svc.label}
              </button>
            ))}
          </div>
        </div>

        {projectsLoading ? (
          <p className={w.empty}>Loading projects…</p>
        ) : projects.length === 0 ? (
          <p className={w.empty}>No portfolio projects yet.</p>
        ) : (
          <div style={{ maxHeight: 440, overflowY: 'auto', marginTop: 10, borderTop: '1px solid var(--a-border)' }}>
            {projects.map(proj => {
              const isChecked = selections[activeServiceTab].has(proj.slug);
              return (
                <label key={proj.id} className={w.item} style={{ cursor: 'pointer', alignItems: 'center', background: isChecked ? 'var(--a-accent-soft)' : undefined }}>
                  <input
                    type="checkbox"
                    className={w.check}
                    checked={isChecked}
                    onChange={() => toggleProject(activeServiceTab, proj.slug)}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={storageUrl(`projects/${proj.slug}/cover.jpg`)}
                    alt=""
                    style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--a-bg)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                  <span className={w.itemMain}>
                    <span className={w.itemTitle}>{proj.title}</span>
                    {proj.category && <span className={w.itemSub}>{proj.category}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--a-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => saveFeatured(activeServiceTab)} disabled={!!saving}>
            {saving === activeServiceTab ? 'Saving…' : `Save ${activeService.label}`}
          </button>
          {featuredMsgs[activeServiceTab] && (
            <span style={{ fontSize: 13, color: featuredMsgs[activeServiceTab].type === 'ok' ? '#141414' : 'var(--a-danger)' }}>
              {featuredMsgs[activeServiceTab].text}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
