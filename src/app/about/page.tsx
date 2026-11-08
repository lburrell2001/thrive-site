import { loadReelProjects } from '@/lib/workReel';
import { serviceClient } from '@/lib/adminAuth';
import { loadStripPhotos } from '@/lib/homeCollage';
import Shell from '../_site/Shell';
import AboutView from '../_site/about/AboutView';

// The About page (Nov 2026 redesign; metadata in layout.tsx).
// The photo strip is chosen in admin (Website → Homepage → Photos on other pages).
export const revalidate = 300;

export default async function AboutPage() {
  // Project titles label the photo strip (a photo's own caption can be the shot's name).
  const titles = Object.fromEntries((await loadReelProjects()).map((p) => [`/work/${p.slug}`, p.title]));
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: automatic photos */ }
  const photos = await loadStripPhotos(db, 'about');
  return (
    <Shell>
      <AboutView titles={titles} photos={photos} />
    </Shell>
  );
}
