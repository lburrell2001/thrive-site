import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { loadReelProjects } from '@/lib/workReel';
import { loadHomePhotos, loadShareImage } from '@/lib/homeCollage';
import { serviceClient } from '@/lib/adminAuth';
import Shell from './_site/Shell';
import Home from './_site/Home';

// Title and description come from the root layout. This names the one address
// Google should index for the homepage, and sets the link-preview picture (what
// shows when the link is texted or posted), chosen in admin → Homepage.
// openGraph replaces the layout's whole openGraph object, so it's all repeated here.
const SHARE_DESCRIPTION = 'Branding, web development, UX, and social media management with graphics creation for growing brands.';

export async function generateMetadata(): Promise<Metadata> {
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: the default picture */ }
  const share = await loadShareImage(db);
  // A new choice is a new URL, so apps that cache previews fetch the new picture.
  const image = { url: `${SITE_URL}/share-image?v=${encodeURIComponent(share.src.replace(/^.*case-studies\//, '').replace(/^storage:/, ''))}`, width: 1200, height: 630, alt: share.alt, type: 'image/jpeg' };
  return {
    alternates: { canonical: `${SITE_URL}/` },
    openGraph: { title: SITE_NAME, description: SHARE_DESCRIPTION, url: `${SITE_URL}/`, siteName: SITE_NAME, locale: 'en_US', type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title: SITE_NAME, description: SHARE_DESCRIPTION, images: [image.url] },
  };
}

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
