'use client';

// The article editor: write on the left (with a preview that uses the
// public page's styles), and everything about publishing and search on the
// right, including a live checklist for the search the article targets.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import prose from '../../../journal/journal.module.css';
import s from '../journal.module.css';
import { apiGet, apiSend, apiUpload } from '../../proposals/adminApi';
import { Toast, useToast } from '../../proposals/Toast';
import { Article, readingMinutes } from '@/lib/articleMarkdown';
import { journalChecklist } from '@/lib/journalChecklist';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import { storageUrl } from '@/lib/storage';
import type { JournalPost } from '@/types/journal';

type Draft = Pick<JournalPost, 'title' | 'slug' | 'excerpt' | 'body' | 'cover_alt' | 'target_query' | 'service_slug' | 'tags'>;

function draftOf(post: JournalPost): Draft {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    cover_alt: post.cover_alt,
    target_query: post.target_query,
    service_slug: post.service_slug,
    tags: post.tags,
  };
}

const SITE_PAGES: { label: string; path: string }[] = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Contact', path: '/contact' },
  { label: 'About', path: '/about' },
];

export default function JournalEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<JournalPost | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    let cancelled = false;
    apiGet<JournalPost>(`/api/journal/${id}`)
      .then((data) => { if (!cancelled) { setPost(data); setDraft(draftOf(data)); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the article'); });
    return () => { cancelled = true; };
  }, [id]);

  const dirty = useMemo(
    () => Boolean(post && draft && JSON.stringify(draftOf(post)) !== JSON.stringify(draft)),
    [post, draft],
  );

  // Don't lose writing to a stray click on the nav.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async (extra: Partial<Pick<JournalPost, 'status'>> = {}, message = 'Saved.') => {
    if (!draft) return false;
    setSaving(true);
    try {
      const updated = await apiSend<JournalPost>(`/api/journal/${id}`, 'PATCH', { ...draft, ...extra });
      setPost(updated);
      setDraft(draftOf(updated));
      show(message);
      setSaving(false);
      return true;
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
      setSaving(false);
      return false;
    }
  }, [draft, id, show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, save]);

  const checks = useMemo(
    () => (draft && post ? journalChecklist({ ...draft, cover_path: post.cover_path }) : []),
    [draft, post],
  );

  if (error) return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>{error}</p></div></div>;
  if (!post || !draft) return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>Loading…</p></div></div>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const published = post.status === 'published';

  /** Wrap the selection, or insert at the cursor, in the body textarea. */
  function insert(before: string, after = '', placeholder = '') {
    const el = body.current;
    if (!el || !draft) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const chosen = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + chosen + after + value.slice(b);
    set('body', next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + chosen.length);
    });
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await apiUpload<JournalPost>(`/api/journal/${id}/cover`, form);
      setPost(updated);
      show('Cover uploaded.');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not upload', 'error');
    }
    setUploading(false);
  }

  async function remove() {
    if (!window.confirm(`Delete "${post!.title}"? This cannot be undone.`)) return;
    try {
      await apiSend(`/api/journal/${id}`, 'DELETE');
      router.push('/admin/journal');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const passed = checks.filter((c) => c.ok).length;

  return (
    <div className={p.screen}>
      <div className={s.editor}>
        <div className={s.main}>
          <div className={s.topRow}>
            <Link href="/admin/journal" className={p.btn}>← Journal</Link>
            <span className={p.rowMeta}>
              {dirty ? 'Unsaved changes' : 'All changes saved'} · {readingMinutes(draft.body)} min read
            </span>
          </div>

          <input
            className={s.titleInput}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Article title"
            aria-label="Title"
          />

          <div className={s.bodyBar}>
            <div className={p.filters} style={{ margin: 0 }} role="tablist" aria-label="Editor view">
              {(['write', 'preview'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${p.filterChip} ${tab === t ? p.filterChipOn : ''}`} onClick={() => setTab(t)}>
                  {t === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
            {tab === 'write' && (
              <div className={s.tools}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n## ', '\n', 'Section heading')} title="Section heading">H2</button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n### ', '\n', 'Subheading')} title="Subheading">H3</button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('**', '**', 'bold text')} title="Bold"><strong>B</strong></button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n- ', '', 'List item')} title="Bulleted list">• List</button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n> ', '\n', 'A line worth pulling out')} title="Quote">❝</button>
                <select
                  className={`${p.select} ${s.linkSelect}`}
                  value=""
                  aria-label="Link to one of your pages"
                  onChange={(e) => { if (e.target.value) insert('[', `](${e.target.value})`, 'link text'); }}
                >
                  <option value="">Link to a page…</option>
                  {SITE_PAGES.map((pg) => <option key={pg.path} value={pg.path}>{pg.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {tab === 'write' ? (
            <textarea
              ref={body}
              className={s.bodyInput}
              value={draft.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder={'Start with the answer in the first paragraph.\n\n## Use headings for each part\n\nLink to your pages like [brand design](/services/brand-design).'}
              aria-label="Article body"
            />
          ) : (
            <div className={s.preview}>
              {draft.body.trim() ? <Article source={draft.body} className={prose.prose} /> : <p className={p.rowMeta}>Nothing written yet.</p>}
            </div>
          )}
          <p className={p.rowMeta} style={{ marginTop: 8 }}>
            Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>- list</code>, <code>1. list</code>, <code>&gt; quote</code>, <code>[text](/page)</code>, <code>![description](https://image-url)</code> on its own line.
          </p>
        </div>

        <aside className={s.side}>
          <section className={p.card}>
            <div className={s.statusRow}>
              <span className={`${p.badge} ${published ? p.badgeSigned : p.badgeDraft}`}>{published ? 'Published' : 'Draft'}</span>
              {published && <a href={`/journal/${post.slug}`} target="_blank" rel="noreferrer" className={p.rowMeta}>View live ↗</a>}
            </div>
            <div className={s.actions}>
              <button type="button" className={p.btn} onClick={() => save()} disabled={!dirty || saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {published ? (
                <button type="button" className={p.btn} onClick={() => save({ status: 'draft' }, 'Unpublished — it is a draft again.')} disabled={saving}>Unpublish</button>
              ) : (
                <button
                  type="button"
                  className={`${p.btn} ${p.btnPrimary}`}
                  disabled={saving || !draft.body.trim() || !draft.excerpt.trim()}
                  title={!draft.excerpt.trim() ? 'Add a summary first' : undefined}
                  onClick={() => save({ status: 'published' }, 'Published.')}
                >
                  Publish
                </button>
              )}
            </div>
          </section>

          <section className={p.card}>
            <h2 className={p.cardTitle} style={{ marginBottom: 4 }}>Search checklist</h2>
            <p className={p.rowMeta} style={{ margin: '0 0 10px' }}>{passed} of {checks.length} done. Guidance only — it never blocks publishing.</p>
            <ul className={s.checks}>
              {checks.map((c) => (
                <li key={c.id} className={c.ok ? s.checkOk : s.checkTodo}>
                  <span aria-hidden="true">{c.ok ? '✓' : '○'}</span>
                  <span>
                    <span className="sr-only">{c.ok ? 'Done: ' : 'To do: '}</span>
                    <strong>{c.label}</strong>
                    {!c.ok && <span className={s.hint}>{c.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={p.card}>
            <label className={p.field} style={{ display: 'block' }}>
              <span className={p.label}>Search this should rank for</span>
              <input className={p.input} value={draft.target_query ?? ''} onChange={(e) => set('target_query', e.target.value || null)} placeholder="how much does a logo cost in dallas" />
            </label>
            <label className={p.field} style={{ display: 'block' }}>
              <span className={p.label}>Summary for Google ({draft.excerpt.length}/160)</span>
              <textarea className={p.textarea} style={{ minHeight: 80 }} value={draft.excerpt} maxLength={300} onChange={(e) => set('excerpt', e.target.value)} placeholder="One or two sentences that answer the question and make someone want to click." />
            </label>
            <label className={p.field} style={{ display: 'block' }}>
              <span className={p.label}>Address</span>
              <input className={p.input} value={draft.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
              <span className={p.hint}>thrivecreativestudios.org/journal/{draft.slug}{published ? ' — changing it breaks links already shared.' : ''}</span>
            </label>
            <label className={p.field} style={{ display: 'block' }}>
              <span className={p.label}>Related service</span>
              <select className={p.select} value={draft.service_slug ?? ''} onChange={(e) => set('service_slug', (e.target.value || null) as ServiceSlug | null)}>
                <option value="">None</option>
                {Object.values(SERVICE_SEO).map((svc) => <option key={svc.slug} value={svc.slug}>{svc.name}</option>)}
              </select>
            </label>
            <label className={p.field} style={{ display: 'block', marginBottom: 0 }}>
              <span className={p.label}>Tags (comma separated)</span>
              <input className={p.input} value={draft.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="branding, pricing" />
            </label>
          </section>

          <section className={p.card}>
            <h2 className={p.cardTitle} style={{ marginBottom: 10 }}>Cover image</h2>
            {post.cover_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storageUrl(post.cover_path)} alt={draft.cover_alt ?? ''} className={s.coverPreview} />
            )}
            <label className={p.btn} style={{ marginBottom: 10 }}>
              {uploading ? 'Uploading…' : post.cover_path ? 'Replace image' : 'Upload image'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ''; }} />
            </label>
            <label className={p.field} style={{ display: 'block', marginBottom: 0 }}>
              <span className={p.label}>Image description</span>
              <input className={p.input} value={draft.cover_alt ?? ''} onChange={(e) => set('cover_alt', e.target.value || null)} placeholder="What the image shows" />
            </label>
          </section>

          <button type="button" className={`${p.btn} ${p.btnDanger}`} onClick={remove}>Delete article</button>
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
