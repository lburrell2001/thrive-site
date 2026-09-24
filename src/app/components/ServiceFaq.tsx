// Questions and answers at the bottom of a service page, plus the page's
// structured data: the service itself, its FAQs and its breadcrumb trail.
//
// Uses the page's own .sp-section-* classes for the headings, so it matches
// whichever service page it sits in.

import { BUSINESS_ID, SITE_URL, absoluteUrl, jsonLd } from '@/lib/seo';
import { DFW_AREAS, SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import s from './ServiceFaq.module.css';

export default function ServiceFaq({ slug, accent }: { slug: ServiceSlug; accent: string }) {
  const service = SERVICE_SEO[slug];
  const url = absoluteUrl(service.path);

  const areaServed = [
    ...DFW_AREAS.map((name) => ({ '@type': 'City', name, containedInPlace: { '@type': 'State', name: 'Texas' } })),
    ...(service.remote ? [{ '@type': 'Country', name: 'United States' }] : []),
  ];

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: service.name,
        serviceType: service.serviceType,
        description: service.description,
        url,
        provider: { '@id': BUSINESS_ID },
        areaServed,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: service.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Services', item: absoluteUrl('/services') },
          { '@type': 'ListItem', position: 3, name: service.name, item: url },
        ],
      },
    ],
  };

  return (
    <section className={s.faq} aria-labelledby={`faq-${slug}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <p className="sp-section-eyebrow">Questions</p>
      <h2 id={`faq-${slug}`} className="sp-section-heading">GOOD TO KNOW</h2>
      <div className={s.list}>
        {service.faqs.map((f) => (
          <details key={f.q} className={s.item} style={{ ['--accent' as string]: accent }}>
            <summary className={s.question}>{f.q}</summary>
            <p className={s.answer}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
