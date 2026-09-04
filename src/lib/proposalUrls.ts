// One place that decides what this deployment's public origin is.
//
// The PDF renderer has to fetch the print page over HTTP, so it needs an
// absolute URL — and on Vercel the function does not inherently know its own
// public hostname.

import 'server-only';

export function resolveSiteOrigin(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Local development, and any host that sets neither.
  return new URL(req.url).origin;
}

export function proposalPrintUrl(origin: string, slug: string, token: string): string {
  return `${origin}/p/${encodeURIComponent(slug)}/print?t=${encodeURIComponent(token)}`;
}

export function proposalPdfUrl(origin: string, id: string, token: string): string {
  return `${origin}/api/proposals/${id}/pdf?t=${encodeURIComponent(token)}`;
}
