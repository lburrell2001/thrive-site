export const runtime = 'nodejs';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import {
  addSharedMailbox, authorizeUrl, disconnectOutlook, loadConnection, outlookConfigured, OutlookError, removeSharedMailbox, setSendFrom,
} from '@/lib/outlook';
import { syncOutlook } from '@/lib/outlookSync';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

/** Connection status for Settings → Email, and Google Voice alerts from numbers not in the CRM. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const [connection, unmatched] = await Promise.all([
    loadConnection(auth.db).catch(() => null),
    auth.db.from('voice_events').select('id, kind, phone, caller_name, body, occurred_at').is('contact_id', null).order('occurred_at', { ascending: false }).limit(20),
  ]);
  return NextResponse.json({
    ok: true,
    data: {
      configured: outlookConfigured(),
      ready: !unmatched.error,
      connection,
      voiceNumber: Boolean(process.env.GOOGLE_VOICE_NUMBER),
      unmatchedVoice: unmatched.data ?? [],
    },
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['connect', 'sync', 'disconnect']) }),
  // Another mailbox to read (hello@), or which one CRM email goes from.
  z.object({ action: z.enum(['add_mailbox', 'remove_mailbox', 'send_from']), email: z.string().trim().max(320) }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Unknown action');

  try {
    switch (parsed.data.action) {
      case 'connect':
        return NextResponse.json({ ok: true, data: { url: authorizeUrl(resolveSiteOrigin(req)) } });
      case 'sync':
        return NextResponse.json({ ok: true, data: await syncOutlook(auth.db) });
      case 'disconnect':
        await disconnectOutlook(auth.db);
        return NextResponse.json({ ok: true, data: null });
      case 'add_mailbox':
        await addSharedMailbox(auth.db, parsed.data.email);
        return NextResponse.json({ ok: true, data: null });
      case 'remove_mailbox':
        await removeSharedMailbox(auth.db, parsed.data.email);
        return NextResponse.json({ ok: true, data: null });
      case 'send_from':
        await setSendFrom(auth.db, parsed.data.email);
        return NextResponse.json({ ok: true, data: null });
    }
  } catch (error) {
    if (error instanceof OutlookError) return badRequest(error.message);
    throw error;
  }
}
