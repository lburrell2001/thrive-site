'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import type { JournalPostSummary } from '@/types/journal';

export default function JournalAdminPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<JournalPostSummary[] | null>(null);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    let cancelled = false;
    apiGet<JournalPostSummary[]>('/api/journal')
      .then((data) => { if (!cancelled) setPosts(data); })
      .catch((error) => {
        if (cancelled) return;
        show(error instanceof Error ? error.message : 'Could not load the journal', 'error');
        setPosts([]);
      });
    return () => { cancelled = true; };
  }, [show]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const created = await apiSend<{ id: string }>('/api/journal', 'POST', { title: title.trim() });
      router.push(`/admin/journal/${created.id}`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not start the article', 'error');
      setCreating(false);
    }
  }

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Journal</h1>
            <p className={p.pageSub}>
              Articles at /journal. Each one should answer a question your clients search for — that is how the site gets found on Google beyond your name.
            </p>
          </div>
        </div>

        <form onSubmit={create} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <input
            className={p.input}
            style={{ flex: '1 1 320px', maxWidth: 560 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='New article title, e.g. "How much does a logo cost in Dallas?"'
            aria-label="New article title"
          />
          <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={creating || !title.trim()}>
            {creating ? 'Starting…' : 'New article'}
          </button>
        </form>

        <div className={p.list}>
          {posts === null && <p className={p.empty}>Loading…</p>}
          {posts?.length === 0 && <p className={p.empty}>No articles yet. Start with a question a client asked you this month.</p>}
          {posts?.map((post) => (
            <div key={post.id} className={p.row} style={{ gridTemplateColumns: '1fr 100px 110px auto' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/journal/${post.id}`} className={p.rowTitle}>{post.title}</Link>
                <p className={p.rowMeta}>
                  /journal/{post.slug} · {post.reading_minutes} min read
                  {post.target_query ? ` · for “${post.target_query}”` : ''}
                </p>
              </div>
              <span className={`${p.badge} ${post.status === 'published' ? p.badgeSigned : p.badgeDraft}`}>
                {post.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <span className={`${p.rowMeta} ${p.rowHideSmall}`}>
                {post.status === 'published' && post.published_at ? formatDate(post.published_at) : `Edited ${formatDate(post.updated_at)}`}
              </span>
              <div className={p.rowActions}>
                {post.status === 'published' && (
                  <a href={`/journal/${post.slug}`} target="_blank" rel="noreferrer" className={`${p.btn} ${p.btnSmall}`}>View</a>
                )}
                <Link href={`/admin/journal/${post.id}`} className={`${p.btn} ${p.btnSmall}`}>Edit</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
