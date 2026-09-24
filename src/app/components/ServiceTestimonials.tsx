// Approved client reviews on a service page. Shows nothing until there is
// at least one, so a new service page never has an empty "reviews" block.
//
// Deliberately no Review/AggregateRating structured data: Google ignores
// review markup a business publishes about itself.

import { reviewsForService } from '@/lib/reviews';
import type { ServiceSlug } from '@/lib/serviceSeo';
import s from './ServiceTestimonials.module.css';

export default async function ServiceTestimonials({ slug, accent }: { slug: ServiceSlug; accent: string }) {
  const reviews = await reviewsForService(slug).catch(() => []);
  if (reviews.length === 0) return null;

  return (
    <section className={s.section} aria-labelledby={`reviews-${slug}`}>
      <p className="sp-section-eyebrow">Kind words</p>
      <h2 id={`reviews-${slug}`} className="sp-section-heading">WHAT CLIENTS SAY</h2>
      <div className={s.grid}>
        {reviews.map((r) => (
          <figure key={r.id} className={s.card} style={{ ['--accent' as string]: accent }}>
            {r.rating ? (
              <p className={s.stars} aria-label={`${r.rating} out of 5 stars`}>
                {'★'.repeat(r.rating)}<span className={s.starsOff}>{'★'.repeat(5 - r.rating)}</span>
              </p>
            ) : null}
            <blockquote className={s.quote}>“{r.body}”</blockquote>
            <figcaption className={s.who}>
              <strong>{r.display_name}</strong>
              {r.display_role && <span>{r.display_role}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
