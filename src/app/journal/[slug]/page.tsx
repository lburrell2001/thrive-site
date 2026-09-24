import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicLayout from '../../components/PublicLayout';
import { Article, readingMinutes } from '@/lib/articleMarkdown';
import { formatPostDate, publishedPost, publishedPosts } from '@/lib/journalRepo';
import { BUSINESS_ID, SITE_NAME, SITE_URL, absoluteUrl, buildPageMetadata, jsonLd } from '@/lib/seo';
import { SERVICE_SEO } from '@/lib/serviceSeo';
import { storageUrl } from '@/lib/storage';
import s from '../journal.module.css';

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) return { title: 'Article not found', robots: { index: false } };

  const base = buildPageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/journal/${post.slug}`,
    keywords: post.tags,
  });
  const image = post.cover_path ? storageUrl(post.cover_path) : undefined;
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: ['Lauren Burrell'],
      ...(image ? { images: [{ url: image, alt: post.cover_alt ?? post.title }] } : {}),
    },
    twitter: { ...base.twitter, ...(image ? { images: [image] } : {}) },
  };
}

export default async function JournalArticle({ params }: Props) {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) notFound();

  const service = post.service_slug ? SERVICE_SEO[post.service_slug] : null;
  const more = (await publishedPosts(4)).filter((p) => p.id !== post.id).slice(0, 3);
  const url = absoluteUrl(`/journal/${post.slug}`);
  const cover = post.cover_path ? storageUrl(post.cover_path) : null;

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: post.title,
        description: post.excerpt,
        url,
        mainEntityOfPage: url,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        ...(cover ? { image: cover } : {}),
        author: { '@type': 'Person', name: 'Lauren Burrell', url: `${SITE_URL}/about` },
        publisher: { '@id': BUSINESS_ID, name: SITE_NAME },
        ...(post.tags.length ? { keywords: post.tags.join(', ') } : {}),
        ...(service ? { about: { '@id': `${SITE_URL}${service.path}#service` } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Journal', item: absoluteUrl('/journal') },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <PublicLayout>
      <div className={s.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
        <article className={s.article}>
          <Link href="/journal" className={s.back}>← JOURNAL</Link>
          <h1 className={s.articleTitle}>{post.title}</h1>
          <p className={s.articleMeta}>
            By Lauren Burrell · <time dateTime={post.published_at ?? undefined}>{formatPostDate(post.published_at)}</time> · {readingMinutes(post.body)} min read
          </p>
          {cover && (
            <figure className={s.cover}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={post.cover_alt ?? ''} />
            </figure>
          )}
          <Article source={post.body} className={s.prose} />

          <aside className={s.cta} style={{ background: '#0a0a0a' }}>
            <p className={s.ctaTitle}>{service ? `NEED HELP WITH ${service.name.toUpperCase()}?` : 'READY TO START YOUR PROJECT?'}</p>
            <p className={s.ctaText}>
              Thrive Creative Studios is a Dallas creative studio working with businesses across DFW and remotely across the US.
            </p>
            <div className={s.ctaActions}>
              <a href="/contact" className={s.ctaButton} style={{ background: '#e40586', color: '#fff' }}>START A PROJECT →</a>
              {service && (
                <a href={service.path} className={s.ctaButton} style={{ background: '#fff', color: '#0a0a0a' }}>
                  SEE {service.name.toUpperCase()}
                </a>
              )}
            </div>
          </aside>
        </article>

        {more.length > 0 && (
          <section className={s.more} aria-labelledby="more-articles">
            <h2 id="more-articles" className={s.moreTitle}>MORE FROM THE JOURNAL</h2>
            <div className={s.grid}>
              {more.map((p) => (
                <a key={p.id} href={`/journal/${p.slug}`} className={s.card}>
                  <div className={s.cardImage}>
                    {p.cover_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={storageUrl(p.cover_path)} alt={p.cover_alt ?? ''} loading="lazy" />
                    )}
                  </div>
                  <div className={s.cardBody}>
                    <p className={s.cardMeta}>{formatPostDate(p.published_at)} · {p.reading_minutes} min read</p>
                    <h3 className={s.cardTitle}>{p.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
