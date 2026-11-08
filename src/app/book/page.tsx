import { serviceClient } from '@/lib/adminAuth';
import { loadStripPhotos } from '@/lib/homeCollage';
import BookView from './BookView';

// Book a call (metadata in layout.tsx). The photo strip is chosen in admin
// (Website → Homepage → Photos on other pages); saving there revalidates this page.
export const revalidate = 300;

export default async function BookPage() {
  let db = null;
  try { db = serviceClient(); } catch { /* no service key: automatic photos */ }
  return <BookView photos={await loadStripPhotos(db, 'book')} />;
}
