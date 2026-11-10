export const runtime = 'nodejs';

// The homepage's link-preview picture (what shows when the link is texted or
// posted): the photo chosen in admin (Website → Homepage → Link preview;
// src/lib/homeCollage.ts), cropped to 1200×630 as a JPEG, the size and format
// iMessage, Facebook, LinkedIn and X all read. Not under /api/, which robots.txt
// keeps crawlers out of.

import sharp from 'sharp';
import { serviceClient } from '@/lib/adminAuth';
import { loadShareImage } from '@/lib/homeCollage';
import { SITE_URL } from '@/lib/seo';

export async function GET(req: Request) {
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: the default picture */ }
  const share = await loadShareImage(db);
  try {
    // Case-study images are static files on the site (or in storage): fetched over HTTP,
    // because files in public/ aren't inside the function on Vercel.
    const origin = process.env.NODE_ENV === 'production' ? SITE_URL : new URL(req.url).origin;
    const res = await fetch(new URL(share.url, origin), { cache: 'no-store' });
    if (!res.ok) throw new Error(`image ${res.status}`);
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        // The page links here with ?v=<photo>, so a new choice is a new URL.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (e) {
    console.error('[share-image]', e);
    return Response.redirect(new URL('/hero-thrive-desk.jpg', SITE_URL), 302);
  }
}
