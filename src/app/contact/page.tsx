import { loadReelProjects } from '@/lib/workReel';
import Shell from '../_site/Shell';
import ContactView from '../_site/contact/ContactView';

// The contact page (Nov 2026 redesign; metadata in layout.tsx). The form posts
// to /api/contact with the same fields and attribution as before.
export const revalidate = 3600;

export default async function ContactPage() {
  // Project titles label the photo mosaic (a photo's own caption can be the shot's name).
  const titles = Object.fromEntries((await loadReelProjects()).map((p) => [`/work/${p.slug}`, p.title]));
  return (
    <Shell>
      <ContactView titles={titles} />
    </Shell>
  );
}
