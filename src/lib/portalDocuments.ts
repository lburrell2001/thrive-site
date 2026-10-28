// Browser side of /api/portal/documents: the signed-in client's proposals and
// files, with private documents already turned into short-lived links.

import { supabasePortal } from '@/lib/supabasePortal';

export async function loadMyDocuments<F, P>(): Promise<{ files: F[]; proposals: P[] } | null> {
  const { data: { session } } = await supabasePortal.auth.getSession();
  if (!session) return null;
  const res = await fetch('/api/portal/documents', { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!res.ok) return null;
  return (await res.json()) as { files: F[]; proposals: P[] };
}
