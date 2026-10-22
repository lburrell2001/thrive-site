// The Opinly blog: every /blog page from one optional catch-all route.
// Posts are flat (/blog/<slug>); archives live under their prefixes
// (/blog/category/<slug>, /blog/tag/<slug>, /blog/authors[/<slug>]).
// Content comes from the Opinly API through the cached, 'opinly'-tagged
// client; /api/opinly drops that cache when something is published.

import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateOpinlyMetadata, buildBlogPostingJsonLd, buildFaqJsonLd, opinlyConfig } from '@opinly/next';
import { OpinlyContent } from '@opinly/react';
import {
  authorPath,
  calculateReadingTime,
  categoryPath,
  imageUrl,
  postPath,
  tagPath,
  type SeoResolved,
} from '@opinly/shared';
import type { Post } from '@opinly/backend';
import PublicLayout from '../../components/PublicLayout';
import { opinly } from '@/lib/opinly';
import { jsonLd } from '@/lib/seo';
import s from '../../journal/journal.module.css';
import b from '../blog.module.css';

export const revalidate = 3600;

const config = opinlyConfig;
const categoryPrefix = config.categoryPrefix ?? 'category';
const authorPrefix = config.authorPrefix ?? 'authors';
const tagPrefix = config.tagPrefix ?? 'tag';

type BlogPageProps = { params: Promise<{ slug?: string[] }> };

const loadRoute = async (slug: string[]) => {
  if (slug.length === 0) {
    const [posts, categories] = await Promise.all([opinly.posts({ limit: 24 }), opinly.categories()]);
    return { type: 'home' as const, data: { posts: posts.data, categories } };
  }
  if (slug[0] === categoryPrefix && slug.length === 2) {
    const [categories, list] = await Promise.all([opinly.categories(), opinly.posts({ category: slug[1] })]);
    const meta = categories.find((c) => c.slug === slug[1]);
    if (!meta) return { type: 'not-found' as const };
    return { type: 'category' as const, data: { slug: meta.slug, name: meta.title, description: meta.description, posts: list.data } };
  }
  if (slug[0] === tagPrefix && slug.length === 2) {
    const [tags, list] = await Promise.all([opinly.tags(), opinly.posts({ tag: slug[1] })]);
    const meta = tags.find((t) => t.slug === slug[1]);
    if (!meta) return { type: 'not-found' as const };
    return { type: 'tag' as const, data: { slug: meta.slug, name: meta.name, description: null, posts: list.data } };
  }
  if (slug[0] === authorPrefix && slug.length <= 2) {
    if (!slug[1]) return { type: 'authors' as const, data: (await opinly.authors()).data };
    const author = await opinly.author(slug[1]);
    return author.type === 'author' ? { type: 'author' as const, data: author.data } : { type: 'not-found' as const };
  }
  // Posts are flat: a single-segment slug. Anything deeper isn't a post route.
  if (slug.length !== 1) return { type: 'not-found' as const };
  const post = await opinly.post(slug[0]);
  return post ? { type: 'post' as const, data: post } : { type: 'not-found' as const };
};

type Route = Awaited<ReturnType<typeof loadRoute>>;

// Map the route to the neutral SeoResolved generateOpinlyMetadata understands.
function toSeo(route: Route): SeoResolved {
  switch (route.type) {
    case 'post': return { type: 'post', data: route.data };
    case 'category': return { type: 'category', data: route.data };
    case 'tag': return { type: 'tag', data: route.data };
    case 'author': return { type: 'author', data: route.data };
    default: return { type: route.type };
  }
}

export async function generateMetadata(props: BlogPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await props.params;
  const route = await loadRoute(slug ?? []);
  if (route.type === 'not-found') return { title: 'Article not found', robots: { index: false } };
  const meta = await generateOpinlyMetadata(toSeo(route), parent);
  // The layout's title template adds " | Thrive Creative Studios"; Opinly's
  // default index titles already name the company, so say what the page is.
  if (route.type === 'home') {
    const title = 'Blog — Websites, Branding & Marketing for Small Businesses';
    const description = 'Articles on websites, branding, social media and marketing for small businesses, from Thrive Creative Studios in Dallas.';
    return { ...meta, title, description, openGraph: { ...meta.openGraph, title, description } };
  }
  if (route.type === 'category' || route.type === 'tag' || route.type === 'authors') {
    const title = route.type === 'authors' ? 'Blog authors' : `${route.data.name} — Blog`;
    return { ...meta, title, openGraph: { ...meta.openGraph, title } };
  }
  return meta;
}

export default async function BlogPage(props: BlogPageProps) {
  const { slug } = await props.params;
  const route = await loadRoute(slug ?? []);

  let body: React.ReactNode;
  switch (route.type) {
    case 'home':
      body = <BlogIndex posts={route.data.posts} categories={route.data.categories.filter((c) => c.posts.length > 0)} />;
      break;
    case 'post':
      body = <BlogPost post={route.data} />;
      break;
    case 'category':
    case 'tag':
      body = <Archive kicker={route.type === 'category' ? 'Category' : 'Topic'} title={route.data.name} description={route.data.description} posts={route.data.posts} />;
      break;
    case 'author':
      body = <Archive kicker="Author" title={route.data.name} description={route.data.bio} posts={route.data.posts} />;
      break;
    case 'authors':
      body = <AuthorsView authors={route.data} />;
      break;
    default:
      notFound();
  }

  return (
    <PublicLayout>
      <div className={s.page}>{body}</div>
    </PublicLayout>
  );
}

/* ------------------------------------------------------------------ views */

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
}

function PostCard({ post, as: Heading = 'h2' }: { post: Post; as?: 'h2' | 'h3' }) {
  return (
    <Link href={postPath(config, post)} className={s.card}>
      <div className={s.cardImage}>
        {post.image?.fileKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(post.image.fileKey, config)} alt={post.image.alt ?? ''} loading="lazy" />
        )}
      </div>
      <div className={s.cardBody}>
        <p className={s.cardMeta}>
          {formatDate(post.firstPublishedAt)}{post.category ? ` · ${post.category.name}` : ''}
        </p>
        <Heading className={s.cardTitle}>{post.title}</Heading>
        {post.description && <p className={s.cardExcerpt}>{post.description}</p>}
      </div>
    </Link>
  );
}

function PostGrid({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return <p className={s.empty}>The first articles are on their way.</p>;
  return (
    <div className={s.grid}>
      {posts.map((post) => <PostCard key={post.slug} post={post} />)}
    </div>
  );
}

function BlogIndex({ posts, categories }: { posts: Post[]; categories: { slug: string; title: string }[] }) {
  return (
    <>
      <h1 className={s.pageTitle}>THE THRIVE<br />BLOG</h1>
      <p className={s.lede}>
        Websites, branding, social media and marketing for small businesses — what works, what it costs, and what to ask before you hire anyone.
      </p>
      {categories.length > 1 && (
        <nav className={b.chips} aria-label="Categories">
          {categories.map((c) => <Link key={c.slug} href={categoryPath(config, c.slug)} className={b.chip}>{c.title}</Link>)}
        </nav>
      )}
      <PostGrid posts={posts} />
    </>
  );
}

function Archive({ kicker, title, description, posts }: { kicker: string; title: string; description?: string | null; posts: Post[] }) {
  return (
    <>
      <Link href={config.blogPrefix} className={s.back}>← BLOG</Link>
      <h1 className={s.pageTitle}>{title.toUpperCase()}</h1>
      <p className={s.lede}>{description || `${kicker}: every article on ${title}.`}</p>
      <PostGrid posts={posts} />
    </>
  );
}

function AuthorsView({ authors }: { authors: { name: string; slug: string; bio: string | null; posts: Post[] }[] }) {
  return (
    <>
      <Link href={config.blogPrefix} className={s.back}>← BLOG</Link>
      <h1 className={s.pageTitle}>AUTHORS</h1>
      <div className={b.authors}>
        {authors.map((a) => (
          <Link key={a.slug} href={authorPath(config, a.slug)} className={b.author}>
            <span className={b.authorName}>{a.name}</span>
            {a.bio && <span className={b.authorBio}>{a.bio}</span>}
            <span className={b.authorCount}>{a.posts.length} {a.posts.length === 1 ? 'article' : 'articles'}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

type FullPost = NonNullable<Awaited<ReturnType<typeof opinly.post>>>;

async function BlogPost({ post }: { post: FullPost }) {
  const cover = post.titleFile?.fileKey ? imageUrl(post.titleFile.fileKey, config) : null;
  const related = post.category
    ? (await opinly.posts({ category: post.category.slug, limit: 4 })).data.filter((p) => p.slug !== post.slug).slice(0, 3)
    : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildBlogPostingJsonLd(post)) }} />
      {post.faqs?.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildFaqJsonLd(post.faqs)) }} />
      ) : null}

      <article className={s.article}>
        <Link href={config.blogPrefix} className={s.back}>← BLOG</Link>
        <h1 className={s.articleTitle}>{post.title}</h1>
        <p className={s.articleMeta}>
          {post.author && <>By <Link href={authorPath(config, post.author.slug)} className={b.metaLink}>{post.author.name}</Link> · </>}
          <time dateTime={post.firstPublishedAt}>{formatDate(post.firstPublishedAt)}</time>
          {' · '}{calculateReadingTime(post.content)} min read
          {post.category && <> · <Link href={categoryPath(config, post.category.slug)} className={b.metaLink}>{post.category.name}</Link></>}
        </p>
        {cover && (
          <figure className={s.cover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={post.titleFile?.altText ?? ''} />
          </figure>
        )}

        <div className={`${s.prose} ${b.body}`}>
          <OpinlyContent content={post.content} config={config} />
        </div>

        {post.faqs?.length ? (
          <section className={b.faq} aria-labelledby="faq-title">
            <h2 id="faq-title" className={b.faqTitle}>Questions people ask</h2>
            {post.faqs.map((f) => (
              <details key={f.question} className={b.faqItem}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </section>
        ) : null}

        {post.tags.length > 0 && (
          <nav className={b.chips} aria-label="Topics" style={{ marginTop: 32 }}>
            {post.tags.map((t) => <Link key={t.slug} href={tagPath(config, t.slug)} className={b.chip}>{t.name}</Link>)}
          </nav>
        )}

        <aside className={s.cta} style={{ background: '#0a0a0a' }}>
          <p className={s.ctaTitle}>READY TO START YOUR PROJECT?</p>
          <p className={s.ctaText}>
            Thrive Creative Studios is a Dallas creative studio working with businesses across DFW and remotely across the US.
          </p>
          <div className={s.ctaActions}>
            <Link href="/contact" className={s.ctaButton} style={{ background: '#e40586', color: '#fff' }}>START A PROJECT →</Link>
            <Link href="/book" className={s.ctaButton} style={{ background: '#fff', color: '#0a0a0a' }}>BOOK A FREE CALL</Link>
          </div>
        </aside>
      </article>

      {related.length > 0 && (
        <section className={s.more} aria-labelledby="more-articles">
          <h2 id="more-articles" className={s.moreTitle}>MORE ON {post.category!.name.toUpperCase()}</h2>
          <div className={s.grid}>
            {related.map((p) => <PostCard key={p.slug} post={p} as="h3" />)}
          </div>
        </section>
      )}
    </>
  );
}
