import { loadReelProjects } from '@/lib/workReel';
import { serviceClient } from '@/lib/adminAuth';
import { loadStripPhotos } from '@/lib/homeCollage';
import Shell from '../_site/Shell';
import ContactView from '../_site/contact/ContactView';

// The contact page (Nov 2026 redesign; metadata in layout.tsx). The form posts
// to /api/contact with the same fields and attribution as before.
// The photo strip is chosen in admin (Website → Homepage → Photos on other pages).
export const revalidate = 300;

export default async function ContactPage() {
  // Project titles label the photo mosaic (a photo's own caption can be the shot's name).
  const titles = Object.fromEntries((await loadReelProjects()).map((p) => [`/work/${p.slug}`, p.title]));
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: automatic photos */ }
  const photos = await loadStripPhotos(db, 'contact');
  return (
    <Shell>
      <ContactView titles={titles} photos={photos} />
    </Shell>
  );
}
