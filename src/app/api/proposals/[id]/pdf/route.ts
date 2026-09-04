export const runtime = 'nodejs';
// Cold-starting Chromium and rendering a dozen pages does not fit in the
// default serverless timeout.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/adminAuth';
import { pdfFilename, renderProposalPdf } from '@/lib/proposalPdf';
import { proposalPrintUrl, resolveSiteOrigin } from '@/lib/proposalUrls';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Return the proposal as a PDF.
 *
 * Two callers, two ways in:
 *   - Lauren, with the admin passcode header.
 *   - The client, with `?t=<access_token>` — the same secret that lets them
 *     read the proposal in the first place.
 *
 * If Chrome cannot start — the most likely failure on a serverless host — the
 * client is redirected to the print page with the dialog open, so "Save as
 * PDF" always produces a PDF even when this route cannot.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(req.url);
  const suppliedToken = url.searchParams.get('t');

  const db = serviceClient();
  const { data: proposal } = await db
    .from('proposals')
    .select('id, slug, title, access_token')
    .eq('id', id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorise before anything expensive happens.
  let authorised = false;
  if (suppliedToken && suppliedToken === proposal.access_token) {
    authorised = true;
  } else if (req.headers.get('X-Admin-Passcode')) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    authorised = true;
  }

  if (!authorised) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const origin = resolveSiteOrigin(req);
  const printUrl = proposalPrintUrl(origin, proposal.slug, proposal.access_token);

  try {
    const pdf = await renderProposalPdf({ url: printUrl });

    await db.from('proposal_events').insert({
      proposal_id: proposal.id,
      type: 'downloaded',
      metadata: {
        by: suppliedToken ? 'client' : 'admin',
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
        bytes: pdf.byteLength,
      },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename(proposal.title)}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('PDF generation failed:', error);

    // Fall back to the browser's own print-to-PDF rather than handing the
    // client an error page. Same document either way.
    if (suppliedToken) {
      return NextResponse.redirect(`${printUrl}&print=1`, 302);
    }

    return NextResponse.json(
      { error: 'Could not generate the PDF. Open the print view and use your browser instead.' },
      { status: 500 },
    );
  }
}
