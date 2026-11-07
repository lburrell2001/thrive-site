// A service page's body, rendered by each /services/<slug> route inside the
// site shell. Copy comes from configs.ts (the page's own wording), the longer
// read and FAQs from serviceSeo.ts, prices from servicePricing.ts, photos from
// workPhotos.ts and approved reviews from Supabase. Carries the page's
// Service / FAQPage / BreadcrumbList structured data.

import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import { SERVICE_PRICING } from '@/lib/servicePricing';
import { WORK_PHOTOS } from '@/lib/workPhotos';
import { reviewsForService } from '@/lib/reviews';
import { jsonLd } from '@/lib/seo';
import { serviceJsonLd } from '../../components/ServiceFaq';
import { SERVICE_CONFIGS } from './configs';
import ServiceView from './ServiceView';

export default async function ServicePage({ slug }: { slug: ServiceSlug }) {
  const config = SERVICE_CONFIGS[slug];
  if (!config) throw new Error(`No service config for ${slug}`);
  const seo = SERVICE_SEO[slug];
  const reviews = await reviewsForService(slug).catch(() => []);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceJsonLd(slug)) }} />
      <ServiceView
        config={config}
        about={seo.about ?? null}
        faqs={seo.faqs}
        pricing={SERVICE_PRICING[slug]}
        photos={WORK_PHOTOS[slug]}
        reviews={reviews.filter((r) => r.body).map((r) => ({ id: r.id, name: r.display_name || 'Client', role: r.display_role, body: r.body! }))}
      />
    </>
  );
}
