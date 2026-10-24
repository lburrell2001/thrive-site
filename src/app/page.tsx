import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export { default } from './newhomepage/page';

// Title, description and social cards come from the root layout; this names
// the one address Google should index for the homepage.
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
};
