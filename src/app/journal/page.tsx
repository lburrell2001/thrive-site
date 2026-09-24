import type { Metadata } from 'next';
import PublicLayout from '../components/PublicLayout';
import { buildPageMetadata } from '@/lib/seo';
import { formatPostDate, publishedPosts } from '@/lib/journalRepo';
import { storageUrl } from '@/lib/storage';
import s from './journal.module.css';

// Cached, and refreshed on demand whenever an article is published or edited.
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: 'Journal — Branding, Web Design & Marketing Advice',
  description:
    'Straight answers on branding, websites, social media and photography for small businesses, from Thrive Creative Studios in Dallas.',
  path: '/journal',
});

export default async function JournalIndex() {
  const posts = await publishedPosts();

  return (
    <PublicLayout>
      <div className={s.page}>
        <p className={s.eyebrow}>Journal</p>
        <h1 className={s.pageTitle}>NOTES FROM<br />THE STUDIO</h1>
        <p className={s.lede}>
          Straight answers on branding, websites, social media and photography — the questions clients ask us most.
        </p>

        {posts.length === 0 ? (
          <p className={s.empty}>The first articles are on their way.</p>
        ) : (
          <div className={s.grid}>
            {posts.map((post) => (
              <a key={post.id} href={`/journal/${post.slug}`} className={s.card}>
                <div className={s.cardImage}>
                  {post.cover_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={storageUrl(post.cover_path)} alt={post.cover_alt ?? ''} loading="lazy" />
                  )}
                </div>
                <div className={s.cardBody}>
                  <p className={s.cardMeta}>{formatPostDate(post.published_at)} · {post.reading_minutes} min read</p>
                  <h2 className={s.cardTitle}>{post.title}</h2>
                  {post.excerpt && <p className={s.cardExcerpt}>{post.excerpt}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
