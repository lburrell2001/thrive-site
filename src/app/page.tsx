import type { Metadata } from 'next';

export { default } from './newhomepage/page';

// Title, description and social cards come from the root layout; this names
// the one address Google should index for the homepage.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};
