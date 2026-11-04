export const runtime = 'nodejs';

// Microsoft sends the browser back here after Lauren signs in to connect
// Outlook. Public by necessity: the signed state proves the sign-in was
// started from admin, and the code is useless without the client secret.

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { completeSignIn } from '@/lib/outlook';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

export async function GET(req: Request) {
  const site = resolveSiteOrigin(req);
  const url = new URL(req.url);
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(`${site}/admin/settings?${new URLSearchParams({ tab: 'email', ...params })}`);

  const failure = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (failure) return back({ outlook_error: failure.split('\r\n')[0].slice(0, 200) });

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return back({ outlook_error: 'Microsoft sent no sign-in code' });

  try {
    await completeSignIn(serviceClient(), code, state, site);
    return back({ outlook: 'connected' });
  } catch (error) {
    return back({ outlook_error: (error instanceof Error ? error.message : 'Could not connect').slice(0, 200) });
  }
}
