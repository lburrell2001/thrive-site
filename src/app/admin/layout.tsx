import type { Metadata } from 'next';
import AdminShell from './AdminShell';

// Private: covers every page under /admin. Crawlers must be able to fetch
// these pages to see this, so /admin is not disallowed in robots.txt.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
