const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BUCKET = "course-media";

export function storageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Project helpers (slug-based)
export function projectCover(slug: string) {
  return storageUrl(`work/${slug}-cover.jpg`);
}

// Resized copy of a cover for cards and strips — originals run up to ~20 MB.
export function projectCoverThumb(slug: string, width = 640) {
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/work/${slug}-cover.jpg?width=${width}&quality=75`;
}

// 1200×630 copy of the cover for link previews. Some original covers are
// ~20 MB, which iMessage, Instagram and Facebook won't fetch.
export function projectCoverOg(slug: string) {
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/work/${slug}-cover.jpg?width=1200&height=630&resize=cover&quality=80`;
}

export function projectGallery(slug: string, file: string) {
  return storageUrl(`projects/${slug}/gallery/${file}`);
}
