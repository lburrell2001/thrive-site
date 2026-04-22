'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter: `var(--font-inter), 'Inter', sans-serif`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type PortfolioProject = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  category_label: string | null;
  year: string | null;
  tagline: string | null;
  overview: string | null;
  role: string | null;
  tools: string[] | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  project_notes: string | null;
  featured: boolean;
};

type GalleryImage = { name: string; url: string };

const EMPTY: Omit<PortfolioProject, 'id'> = {
  title: '', slug: '', category: '', category_label: '', year: '', tagline: '',
  overview: '', role: '', tools: [],
  problem: '', solution: '',
  results: '', project_notes: '', featured: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPasscode() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('admin_passcode') ?? '' : '';
}

async function api(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'X-Admin-Passcode': getPasscode(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json() as { ok?: boolean; error?: string; data?: unknown; url?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed');
  return data;
}

async function directUpload(file: File, storagePath: string, upsert = false): Promise<string> {
  const res = await api('create_upload_url', { path: storagePath, upsert });
  if (!res.signedUrl) throw new Error('Could not get upload URL');
  const up = await fetch(res.signedUrl as string, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!up.ok) throw new Error(`Storage upload failed (${up.status})`);
  return (res.path as string) ?? storagePath;
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1a1a1a', border: '1.5px solid #2a2a2a',
  borderRadius: 6, padding: '9px 12px',
  fontFamily: F.inter, fontSize: 13, color: '#e8e8e8',
  outline: 'none', transition: 'border-color .15s',
};

const labelStyle: React.CSSProperties = {
  fontFamily: F.inter, fontSize: 11, fontWeight: 600,
  color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'block', marginBottom: 5,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: F.inter, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: '#e50586',
      borderBottom: '1px solid #2a2a2a', paddingBottom: 8, marginBottom: 16, marginTop: 24,
    }}>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortfolioAdminPage() {
  const [projects,          setProjects]          = useState<PortfolioProject[]>([]);
  const [selected,          setSelected]          = useState<PortfolioProject | null>(null);
  const [isNew,             setIsNew]             = useState(false);
  const [form,              setForm]              = useState<Omit<PortfolioProject, 'id'>>(EMPTY);
  const [saving,            setSaving]            = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [msg,               setMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Cover image state
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Load projects list
  const loadProjects = useCallback(async () => {
    try {
      const res = await api('list_portfolio_projects');
      setProjects((res.data as PortfolioProject[]) ?? []);
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Load gallery for selected project
  const loadGallery = useCallback(async (slug: string) => {
    if (!slug) { setGallery([]); return; }
    setGalleryLoading(true);
    try {
      const res = await api('list_gallery_images', { slug });
      setGallery((res.data as GalleryImage[]) ?? []);
    } catch {
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  // Select a project
  function selectProject(p: PortfolioProject) {
    setSelected(p);
    setIsNew(false);
    setMobileSidebarOpen(false);
    setForm({
      title: p.title ?? '',
      slug: p.slug ?? '',
      category: p.category ?? '',
      category_label: p.category_label ?? '',
      year: p.year ?? '',
      tagline: p.tagline ?? '',
      overview: p.overview ?? '',
      role: p.role ?? '',
      tools: p.tools ?? [],
      problem: p.problem ?? '',
      solution: p.solution ?? '',
      results: p.results ?? '',
      project_notes: p.project_notes ?? '',
      featured: p.featured ?? false,
    });
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    setCoverUrl(`${supaUrl}/storage/v1/object/public/course-media/work/${p.slug}-cover.jpg`);
    loadGallery(p.slug);
    setMsg(null);
  }

  function startNew() {
    setSelected(null);
    setIsNew(true);
    setForm(EMPTY);
    setCoverUrl(null);
    setGallery([]);
    setMsg(null);
  }

  function handleField(key: keyof typeof EMPTY, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Auto-generate slug from title if creating new
    if (key === 'title' && isNew) {
      setForm((prev) => ({ ...prev, title: value as string, slug: slugify(value as string) }));
    }
  }

  // Save (create or update)
  async function handleSave() {
    if (!form.title || !form.slug) {
      setMsg({ type: 'err', text: 'Title and slug are required.' });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      if (isNew) {
        const res = await api('create_portfolio_project', { ...form, tools: form.tools ?? [] });
        const created = res.data as PortfolioProject;
        await loadProjects();
        setIsNew(false);
        setSelected(created);
        setMsg({ type: 'ok', text: 'Project created.' });
      } else if (selected) {
        await api('update_portfolio_project', { id: selected.id, ...form, tools: form.tools ?? [] });
        await loadProjects();
        setSelected({ ...selected, ...form });
        setMsg({ type: 'ok', text: 'Changes saved.' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  // Delete project
  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.title}"? This cannot be undone.`)) return;
    setDeleting(true); setMsg(null);
    try {
      await api('delete_portfolio_project', { id: selected.id });
      await loadProjects();
      setSelected(null);
      setIsNew(false);
      setForm(EMPTY);
      setCoverUrl(null);
      setGallery([]);
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  }

  // Upload cover image
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const slug = form.slug;
    if (!slug) { setMsg({ type: 'err', text: 'Set a slug before uploading images.' }); return; }
    setCoverUploading(true); setMsg(null);
    try {
      const path = await directUpload(file, `work/${slug}-cover.jpg`, true);
      const res = await api('upload_project_cover', { slug, path });
      setCoverUrl((res.url as string) + '?t=' + Date.now());
      setMsg({ type: 'ok', text: 'Cover image uploaded.' });
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  }

  // Upload gallery images
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const slug = form.slug;
    if (!slug) { setMsg({ type: 'err', text: 'Set a slug before uploading images.' }); return; }
    setGalleryUploading(true); setMsg(null);
    try {
      for (const file of files) {
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = await directUpload(file, `projects/${slug}/gallery/${filename}`, true);
        await api('upload_gallery_image', { slug, filename, path });
      }
      await loadGallery(slug);
      setMsg({ type: 'ok', text: `${files.length} image${files.length > 1 ? 's' : ''} uploaded.` });
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  // Delete gallery image
  async function handleDeleteGalleryImage(img: GalleryImage) {
    if (!confirm(`Delete "${img.name}"?`)) return;
    const slug = form.slug;
    try {
      await api('delete_gallery_image', { slug, filename: img.name });
      setGallery((prev) => prev.filter((g) => g.name !== img.name));
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    }
  }

  const showEditor = isNew || selected !== null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0f0f0f' }}>
      <style>{`
        .port-sidebar {
          width: 260px; flex-shrink: 0; display: flex; flex-direction: column;
          border-right: 1px solid #1f1f1f; overflow: hidden;
        }
        .port-mobile-bar { display: none; }
        @media (max-width: 640px) {
          .port-sidebar {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
            width: 280px !important;
            transform: translateX(-100%); transition: transform .22s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,.4);
          }
          .port-sidebar.mobile-open { transform: translateX(0); }
          .port-mobile-bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #161616; border-bottom: 1px solid #1f1f1f; flex-shrink: 0; }
          .port-editor { padding: 16px 16px 40px !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`port-sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1f1f1f' }}>
          <button
            onClick={startNew}
            style={{
              width: '100%', background: '#e50586', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 0', fontFamily: F.inter, fontSize: 13,
              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            + New Project
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {projects.length === 0 && (
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#444', padding: '16px', textAlign: 'center' }}>
              No projects yet.
            </p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              style={{
                width: '100%', textAlign: 'left', background: selected?.id === p.id ? '#1a1a1a' : 'transparent',
                border: 'none', borderLeft: selected?.id === p.id ? '3px solid #e50586' : '3px solid transparent',
                padding: '10px 16px', cursor: 'pointer',
                transition: 'background .12s',
              }}
            >
              <div style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: selected?.id === p.id ? '#fff' : '#ccc', marginBottom: 2 }}>
                {p.title}
              </div>
              {p.category && (
                <div style={{ fontFamily: F.inter, fontSize: 11, color: '#555' }}>{p.category}</div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Editor ── */}
      {showEditor ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Mobile project selector bar */}
          <div className="port-mobile-bar">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: '#ccc', cursor: 'pointer', flex: 1 }}
            >
              {selected ? selected.title : 'New Project'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="port-editor" style={{ padding: '28px 36px 60px', flex: 1 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: F.bungee, fontSize: 22, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                {isNew ? 'NEW PROJECT' : form.title.toUpperCase() || 'EDIT PROJECT'}
              </h1>
              {!isNew && selected && (
                <p style={{ fontFamily: F.inter, fontSize: 12, color: '#555', margin: '4px 0 0' }}>
                  ID: {selected.id}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {!isNew && selected && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    background: 'transparent', border: '1px solid #3a1a1a', color: '#cc4444',
                    borderRadius: 6, padding: '8px 16px', fontFamily: F.inter, fontSize: 12,
                    fontWeight: 600, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete Project'}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? '#444' : '#e50586', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 22px', fontFamily: F.inter, fontSize: 13,
                  fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Status message */}
          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 6, marginBottom: 20,
              background: msg.type === 'ok' ? 'rgba(12,245,116,0.1)' : 'rgba(229,5,134,0.12)',
              border: `1px solid ${msg.type === 'ok' ? 'rgba(12,245,116,0.3)' : 'rgba(229,5,134,0.3)'}`,
              fontFamily: F.inter, fontSize: 13,
              color: msg.type === 'ok' ? '#0cf574' : '#e50586',
            }}>
              {msg.text}
            </div>
          )}

          {/* ── Basic Info ── */}
          <SectionLabel>Basic Info</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Title *">
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) => handleField('title', e.target.value)}
                placeholder="e.g. DJ Mastamind"
              />
            </Field>
            <Field label="Slug *">
              <input
                style={inputStyle}
                value={form.slug}
                onChange={(e) => handleField('slug', slugify(e.target.value))}
                placeholder="e.g. dj-mastamind"
              />
            </Field>
            <Field label="Category Label">
              <input
                style={inputStyle}
                value={form.category_label ?? ''}
                onChange={(e) => handleField('category_label', e.target.value)}
                placeholder="e.g. Branding · Visual System"
              />
              <div style={{ fontFamily: F.inter, fontSize: 11, color: '#555', marginTop: 4 }}>
                Shown as the pink label on the project hero page
              </div>
            </Field>
            <Field label="Project Tagline">
              <input
                style={inputStyle}
                value={form.tagline ?? ''}
                onChange={(e) => handleField('tagline', e.target.value)}
                placeholder="e.g. A fresh, confident identity made to feel like self-care."
              />
              <div style={{ fontFamily: F.inter, fontSize: 11, color: '#555', marginTop: 4 }}>
                Short description shown on portfolio cards
              </div>
            </Field>
            <Field label="Category">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Brand Design', 'Digital Design', 'UX Design', 'Social Media', 'Photography'].map(cat => {
                  const selected = (form.category ?? '').split(',').map(s => s.trim()).filter(Boolean);
                  const checked = selected.includes(cat);
                  return (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: F.inter, fontSize: 13, color: '#e8e8e8' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? selected.filter(c => c !== cat)
                            : [...selected, cat];
                          handleField('category', next.join(', '));
                        }}
                        style={{ accentColor: '#e50586', width: 14, height: 14, cursor: 'pointer' }}
                      />
                      {cat}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Year">
              <input
                style={inputStyle}
                value={form.year ?? ''}
                onChange={(e) => handleField('year', e.target.value)}
                placeholder="e.g. 2024"
              />
            </Field>
            <Field label="Role">
              <input
                style={inputStyle}
                value={form.role ?? ''}
                onChange={(e) => handleField('role', e.target.value)}
                placeholder="e.g. Creative Director"
              />
            </Field>
            <Field label="Tools (comma-separated)">
              <input
                style={inputStyle}
                value={(form.tools ?? []).join(', ')}
                onChange={(e) => handleField('tools', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                placeholder="e.g. Figma, Illustrator"
              />
            </Field>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="featured"
              checked={form.featured}
              onChange={(e) => handleField('featured', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#e50586', cursor: 'pointer' }}
            />
            <label htmlFor="featured" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>
              Featured project
            </label>
          </div>

          {/* ── Content ── */}
          <SectionLabel>Content</SectionLabel>
          <Field label="Overview">
            <textarea
              style={textareaStyle}
              value={form.overview ?? ''}
              onChange={(e) => handleField('overview', e.target.value)}
              placeholder="Project overview shown on the case study page…"
            />
          </Field>
          <Field label="Problem">
            <textarea
              style={{ ...textareaStyle, minHeight: 72 }}
              value={form.problem ?? ''}
              onChange={(e) => handleField('problem', e.target.value)}
              placeholder="What challenge did the client face?"
            />
          </Field>
          <Field label="Solution">
            <textarea
              style={{ ...textareaStyle, minHeight: 72 }}
              value={form.solution ?? ''}
              onChange={(e) => handleField('solution', e.target.value)}
              placeholder="How did Thrive solve it?"
            />
          </Field>
          <Field label="Results">
            <textarea
              style={{ ...textareaStyle, minHeight: 72 }}
              value={form.results ?? ''}
              onChange={(e) => handleField('results', e.target.value)}
              placeholder="Measurable outcomes…"
            />
          </Field>
          <Field label="Project Notes (internal)">
            <textarea
              style={{ ...textareaStyle, minHeight: 72 }}
              value={form.project_notes ?? ''}
              onChange={(e) => handleField('project_notes', e.target.value)}
              placeholder="Internal notes, context, or production details…"
            />
          </Field>

          {/* ── Cover Image ── */}
          <SectionLabel>Cover Image</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#555', margin: 0 }}>
              Stored at <code style={{ color: '#888' }}>course-media/work/{form.slug || '[slug]'}-cover.jpg</code>
            </p>
            <span style={{
              fontFamily: F.inter, fontSize: 11, fontWeight: 600,
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 4, padding: '3px 8px', color: '#888',
              letterSpacing: '0.04em', whiteSpace: 'nowrap',
            }}>
              Recommended: 1600 × 1000px · Max 5 MB · JPG / PNG / WebP
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {coverUrl && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={coverUrl}
                  alt="Cover"
                  style={{ width: 200, height: 130, objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a2a', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverUpload}
              />
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading || !form.slug}
                style={{
                  background: coverUploading ? '#2a2a2a' : '#1a1a1a',
                  border: '1.5px dashed #3a3a3a', color: coverUploading ? '#555' : '#aaa',
                  borderRadius: 8, padding: '10px 20px',
                  fontFamily: F.inter, fontSize: 12, fontWeight: 600,
                  cursor: coverUploading || !form.slug ? 'default' : 'pointer',
                }}
              >
                {coverUploading ? 'Uploading…' : coverUrl ? 'Replace Cover Image' : 'Upload Cover Image'}
              </button>
              {!form.slug && (
                <p style={{ fontFamily: F.inter, fontSize: 11, color: '#555', marginTop: 6 }}>Set a slug first</p>
              )}
            </div>
          </div>

          {/* ── Gallery ── */}
          <SectionLabel>Gallery Images</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#555', margin: 0 }}>
              Stored at <code style={{ color: '#888' }}>course-media/projects/{form.slug || '[slug]'}/gallery/</code>
            </p>
            <span style={{
              fontFamily: F.inter, fontSize: 11, fontWeight: 600,
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 4, padding: '3px 8px', color: '#888',
              letterSpacing: '0.04em', whiteSpace: 'nowrap',
            }}>
              Recommended: 1200 × 800px · Max 5 MB each · JPG / PNG / WebP
            </span>
          </div>

          {galleryLoading ? (
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#555' }}>Loading gallery…</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {gallery.map((img) => (
                <div key={img.name} style={{ position: 'relative' }}>
                  <img
                    src={img.url}
                    alt={img.name}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 6, display: 'block', border: '1px solid #2a2a2a' }}
                  />
                  <button
                    onClick={() => handleDeleteGalleryImage(img)}
                    title="Delete image"
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.75)', border: '1px solid #555',
                      color: '#ff6666', fontSize: 14, lineHeight: 1,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: F.inter,
                    }}
                  >
                    ×
                  </button>
                  <p style={{ fontFamily: F.inter, fontSize: 10, color: '#555', marginTop: 4, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.name}
                  </p>
                </div>
              ))}
              {gallery.length === 0 && !galleryLoading && (
                <p style={{ fontFamily: F.inter, fontSize: 12, color: '#444' }}>No gallery images yet.</p>
              )}
            </div>
          )}

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleGalleryUpload}
          />
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={galleryUploading || !form.slug}
            style={{
              background: galleryUploading ? '#2a2a2a' : '#1a1a1a',
              border: '1.5px dashed #3a3a3a', color: galleryUploading ? '#555' : '#aaa',
              borderRadius: 8, padding: '10px 20px',
              fontFamily: F.inter, fontSize: 12, fontWeight: 600,
              cursor: galleryUploading || !form.slug ? 'default' : 'pointer',
            }}
          >
            {galleryUploading ? 'Uploading…' : '+ Upload Gallery Images'}
          </button>
          {!form.slug && (
            <p style={{ fontFamily: F.inter, fontSize: 11, color: '#555', marginTop: 6 }}>Set a slug first</p>
          )}

          {/* Bottom save bar */}
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #1f1f1f', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            {!isNew && selected && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: 'transparent', border: '1px solid #3a1a1a', color: '#cc4444',
                  borderRadius: 6, padding: '10px 20px', fontFamily: F.inter, fontSize: 13,
                  fontWeight: 600, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.5 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete Project'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? '#444' : '#e50586', color: '#fff', border: 'none',
                borderRadius: 6, padding: '10px 28px', fontFamily: F.inter, fontSize: 13,
                fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
            </button>
          </div>

          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="port-mobile-bar">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: '#ccc', cursor: 'pointer', flex: 1 }}
            >
              Select Project
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: F.bungee, fontSize: 18, color: '#2a2a2a', letterSpacing: '-0.02em' }}>
              SELECT A PROJECT
            </div>
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#444', textAlign: 'center', maxWidth: 280 }}>
              Choose a project from the sidebar to edit it, or click &ldquo;New Project&rdquo; to create one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
