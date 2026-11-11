// Browser helpers for the Portfolio admin: the /api/admin actions and direct
// uploads to the public course-media bucket through a signed URL.

import { adminHeaders } from '@/lib/adminSession';

export async function api(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json() as { ok?: boolean; error?: string; data?: unknown; url?: string; signedUrl?: string; path?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed');
  return data;
}

export async function directUpload(file: File, storagePath: string, upsert = false): Promise<string> {
  const res = await api('create_upload_url', { path: storagePath, upsert });
  if (!res.signedUrl) throw new Error('Could not get upload URL');
  const up = await fetch(res.signedUrl as string, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!up.ok) throw new Error(`Storage upload failed (${up.status})`);
  return (res.path as string) ?? storagePath;
}
