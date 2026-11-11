'use client';

// Portfolio: the projects behind /work — details, case study copy, cover
// and gallery images. The list sits beside the editor; on phones they stack.

import { useState, useEffect, useRef, useCallback } from 'react';
import ui from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { api, directUpload } from './portfolioApi';
import CaseStudyEditor from './CaseStudyEditor';

const F = {
  inter: 'var(--a-font)',
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

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#fff', border: '1px solid var(--a-border-strong)',
  borderRadius: 10, padding: '9px 11px',
  fontFamily: F.inter, fontSize: 13.5, color: 'var(--a-text)',
  outline: 'none', transition: 'border-color .15s',
};

const labelStyle: React.CSSProperties = {
  fontFamily: F.inter, fontSize: 12, fontWeight: 600,
  color: '#555', display: 'block', marginBottom: 6,
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
    <h3 style={{
      fontFamily: F.inter, fontSize: 15, fontWeight: 700, color: 'var(--a-text)',
      borderTop: '1px solid var(--a-border)', paddingTop: 20, margin: '24px 0 14px',
    }}>
      {children}
    </h3>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: F.inter, fontSize: 12, color: 'var(--a-faint)', margin: '4px 0 0' }}>{children}</p>;
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
    <div className={w.page}>
      <style>{`
        .port-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
        .port-list { position: sticky; top: 16px; max-height: calc(100dvh - 48px); overflow-y: auto; }
        @media (max-width: 900px) {
          .port-grid { grid-template-columns: minmax(0, 1fr); }
          .port-list { position: static; max-height: 320px; }
        }
      `}</style>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Portfolio</h1>
          <p className={w.sub}>The projects on /work: details, the full case study, cover and gallery images.</p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={startNew}>New project</button>
        </div>
      </div>

      <div className="port-grid">
        <section className={`${w.card} port-list`}>
          {projects.length === 0 && <p className={w.empty}>No projects yet.</p>}
          {projects.map((p) => (
            <button key={p.id} type="button" className={w.item} onClick={() => selectProject(p)}
              style={selected?.id === p.id ? { background: 'var(--a-accent-soft)' } : undefined} aria-current={selected?.id === p.id ? 'true' : undefined}>
              <span className={w.itemMain}>
                <span className={w.itemTitle}>{p.title}{p.featured ? <span className={w.muted} style={{ fontWeight: 500 }}> · featured</span> : null}</span>
                {p.category && <span className={w.itemSub}>{p.category}</span>}
              </span>
            </button>
          ))}
        </section>

        {showEditor ? (
          <section className={w.card} style={{ padding: '20px 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{isNew ? 'New project' : form.title || 'Edit project'}</h2>
                {!isNew && selected && <p className={w.muted} style={{ margin: '4px 0 0', fontSize: 12 }}>/work/{selected.slug}</p>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isNew && selected && (
                  <a href={`/work/${selected.slug}`} target="_blank" rel="noreferrer" className={ui.btn}>View</a>
                )}
                <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
                </button>
              </div>
            </div>

          {/* Status message */}
          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 20,
              background: msg.type === 'ok' ? '#0cf574' : 'var(--a-accent-soft)',
              fontSize: 13, fontWeight: 600,
              color: msg.type === 'ok' ? '#141414' : 'var(--a-accent-hover)',
            }}>
              {msg.text}
            </div>
          )}

          {/* ── Basic Info ── */}
          <SectionLabel>Basics</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
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
              <Hint>Shown as the pink label on the project hero page</Hint>
            </Field>
            <Field label="Project Tagline">
              <input
                style={inputStyle}
                value={form.tagline ?? ''}
                onChange={(e) => handleField('tagline', e.target.value)}
                placeholder="e.g. A fresh, confident identity made to feel like self-care."
              />
              <Hint>Short description shown on portfolio cards</Hint>
            </Field>
            <Field label="Category">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Web Design & Development', 'Brand Design', 'Digital Design', 'Social Media', 'Photography'].map(cat => {
                  const selected = (form.category ?? '').split(',').map(s => s.trim()).filter(Boolean);
                  const checked = selected.includes(cat);
                  return (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: F.inter, fontSize: 13.5, color: 'var(--a-text)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? selected.filter(c => c !== cat)
                            : [...selected, cat];
                          handleField('category', next.join(', '));
                        }}
                        style={{ accentColor: 'var(--a-accent)', width: 15, height: 15, cursor: 'pointer' }}
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
              style={{ width: 16, height: 16, accentColor: 'var(--a-accent)', cursor: 'pointer' }}
            />
            <label htmlFor="featured" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>
              Featured project
            </label>
          </div>

          {/* ── Content ── */}
          <SectionLabel>Short layout copy</SectionLabel>
          <Hint>Used on the project page only while it has no case study, and as its search description.</Hint>
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
          <Field label="Project notes (internal)">
            <textarea
              style={{ ...textareaStyle, minHeight: 72 }}
              value={form.project_notes ?? ''}
              onChange={(e) => handleField('project_notes', e.target.value)}
              placeholder="Internal notes, context, or production details…"
            />
          </Field>

          {/* ── Case study ── */}
          <SectionLabel>Case study</SectionLabel>
          {!isNew && selected ? (
            <CaseStudyEditor key={selected.id} projectId={selected.id} slug={selected.slug} title={selected.title}
              category={form.category} onMsg={setMsg} />
          ) : (
            <Hint>Create the project first, then build its case study here.</Hint>
          )}

          {/* ── Cover Image ── */}
          <SectionLabel>Cover image</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: 'var(--a-faint)', margin: 0 }}>
              Stored at <code style={{ color: 'var(--a-muted)' }}>course-media/work/{form.slug || '[slug]'}-cover.jpg</code>
            </p>
            <span className={w.pill} style={{ background: 'var(--a-bg)', color: 'var(--a-muted)' }}>
              At least 3000 × 1500 px, landscape · cropped to 2:1 on computers, 4:3 on phones · JPG
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {coverUrl && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={coverUrl}
                  alt="Cover"
                  style={{ width: 200, height: 130, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--a-border)', display: 'block' }}
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
                className={ui.btn}
              >
                {coverUploading ? 'Uploading…' : coverUrl ? 'Replace cover image' : 'Upload cover image'}
              </button>
              {!form.slug && (
                <Hint>Set a slug first</Hint>
              )}
            </div>
          </div>

          {/* ── Gallery ── */}
          <SectionLabel>Gallery images</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: 'var(--a-faint)', margin: 0 }}>
              Stored at <code style={{ color: 'var(--a-muted)' }}>course-media/projects/{form.slug || '[slug]'}/gallery/</code>
            </p>
            <span className={w.pill} style={{ background: 'var(--a-bg)', color: 'var(--a-muted)' }}>
              Recommended: 1200 × 800px · Max 5 MB each · JPG / PNG / WebP
            </span>
          </div>

          {galleryLoading ? (
            <Hint>Loading gallery…</Hint>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {gallery.map((img) => (
                <div key={img.name} style={{ position: 'relative' }}>
                  <img
                    src={img.url}
                    alt={img.name}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 6, display: 'block', border: '1px solid var(--a-border)' }}
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
                  <p style={{ fontFamily: F.inter, fontSize: 11, color: 'var(--a-faint)', marginTop: 4, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.name}
                  </p>
                </div>
              ))}
              {gallery.length === 0 && !galleryLoading && (
                <Hint>No gallery images yet.</Hint>
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
            className={ui.btn}
          >
            {galleryUploading ? 'Uploading…' : '+ Upload gallery images'}
          </button>
          {!form.slug && (
            <Hint>Set a slug first</Hint>
          )}

          <div style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--a-border)', display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {!isNew && selected ? (
              <button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
            ) : <span />}
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
            </button>
          </div>
          </section>
        ) : (
          <section className={w.card}>
            <p className={w.empty}>Pick a project to edit it, or start a new one.</p>
          </section>
        )}
      </div>
    </div>
  );
}
