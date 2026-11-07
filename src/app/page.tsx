import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';
import { loadReelProjects } from '@/lib/workReel';
import { loadHomePhotos } from '@/lib/homeCollage';
import { serviceClient } from '@/lib/adminAuth';
import Shell from './_site/Shell';
import Home from './_site/Home';

// Title, description and social cards come from the root layout; this names
// the one address Google should index for the homepage.
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
};

// The homepage photos are chosen in admin (Website → Homepage); saving there
// revalidates this page, and it rebuilds at least every 5 minutes regardless.
export const revalidate = 300;

export default async function HomePage() {
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: default collage photos */ }
  const [projects, photos] = await Promise.all([loadReelProjects(), loadHomePhotos(db)]);
  return (
    <Shell>
      <Home projects={projects} photos={photos} />
    </Shell>
  );
}
