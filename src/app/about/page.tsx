import { loadReelProjects } from '@/lib/workReel';
import Shell from '../_site/Shell';
import AboutView from '../_site/about/AboutView';

// The About page (Nov 2026 redesign; metadata in layout.tsx).
export const revalidate = 3600;

export default async function AboutPage() {
  // Project titles label the photo strip (a photo's own caption can be the shot's name).
  const titles = Object.fromEntries((await loadReelProjects()).map((p) => [`/work/${p.slug}`, p.title]));
  return (
    <Shell>
      <AboutView titles={titles} />
    </Shell>
  );
}
