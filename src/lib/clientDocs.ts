// Client documents — proposals, signed proposals and delivered files — live in
// the private `client-documents` bucket. Rows store `private:<path>` in their
// URL column instead of a link; the server swaps that for a signed link that
// expires in an hour each time the rows are read (signDocs). Rows from before
// the move may still hold a plain https link (e.g. a Google Drive link added by
// hand); those pass through unchanged.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DOC_BUCKET = 'client-documents';
const PREFIX = 'private:';
const LINK_SECONDS = 60 * 60;

/** Upload paths that belong in the private bucket. */
export function isDocPath(path: string): boolean {
  return path.startsWith('proposals/') || path.startsWith('client-files/');
}

/** What a row stores for a private document. */
export function docRef(path: string): string {
  return `${PREFIX}${path}`;
}

/** The storage path behind a stored value, or null if it's an ordinary link. */
export function docPath(value: string | null | undefined): string | null {
  return value && value.startsWith(PREFIX) ? value.slice(PREFIX.length) : null;
}

/**
 * Replaces every `private:` value in the given fields with a signed link.
 * One storage call for all of them. A document that can't be signed (deleted
 * from storage) comes back as null rather than a dead link.
 */
export async function signDocs<T extends Record<string, unknown>>(
  db: SupabaseClient,
  rows: T[] | null | undefined,
  fields: (keyof T & string)[],
): Promise<T[]> {
  const list = rows ?? [];
  const paths = new Set<string>();
  for (const row of list) for (const f of fields) {
    const p = docPath(row[f] as string | null);
    if (p) paths.add(p);
  }
  if (!paths.size) return list;

  const { data } = await db.storage.from(DOC_BUCKET).createSignedUrls([...paths], LINK_SECONDS);
  const signed = new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));

  return list.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const f of fields) {
      const p = docPath(row[f] as string | null);
      if (p) out[f] = signed.get(p) ?? null;
    }
    return out as T;
  });
}

/** Deletes a document's file, wherever it is stored. */
export async function removeDoc(db: SupabaseClient, stored: string | null | undefined, legacyPath?: string | null) {
  const p = docPath(stored);
  if (p) await db.storage.from(DOC_BUCKET).remove([p]);
  else if (legacyPath) await db.storage.from('course-media').remove([legacyPath]);
}
