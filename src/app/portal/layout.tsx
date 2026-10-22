import type { Metadata } from 'next';

// Private: covers /portal/login and every client page. Crawlers must be able
// to fetch these pages to see this, so /portal is not disallowed in robots.txt.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // data-opinly-no-capture: if the Opinly pixel loaded on a public page first,
  // nothing typed or clicked in the portal reaches it.
  return <div data-opinly-no-capture style={{ display: 'contents' }}>{children}</div>;
}
