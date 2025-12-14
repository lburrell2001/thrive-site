const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BUCKET = "course-media";

export function storageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Project helpers (slug-based)
export function projectCover(slug: string) {
  return storageUrl(`projects/${slug}/cover.jpg`);
}

export function projectGallery(slug: string, file: string) {
  return storageUrl(`projects/${slug}/gallery/${file}`);
}
