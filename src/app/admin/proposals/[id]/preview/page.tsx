'use client';

import { use, useEffect, useState } from 'react';
import { ProposalRenderer } from '@/components/proposal/ProposalRenderer';
import { proposalFontClass } from '@/lib/proposalFonts';
import type { RenderableProposal } from '@/types/proposal';
import type { RenderMode } from '@/components/proposal/context';

/**
 * Admin preview. Renders the client view exactly — same <ProposalRenderer /> —
 * behind a draft banner, with a web/print toggle so the two modes can be
 * checked against the original PDF side by side.
 *
 * Data comes from /api/admin with the passcode header. The service role key
 * never leaves the server, and no Supabase credential reaches this component.
 */
export default function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proposal, setProposal] = useState<RenderableProposal | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RenderMode>('web');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'X-Admin-Passcode': sessionStorage.getItem('admin_passcode') ?? '',
            'Content-Type': 'application/json',
          },
          // A UUID goes through as `id`; anything else is treated as a slug.
          body: JSON.stringify(
            /^[0-9a-f-]{36}$/i.test(id)
              ? { action: 'get_proposal', id }
              : { action: 'get_proposal', slug: id },
          ),
        });
        const body = (await res.json()) as { data?: RenderableProposal; error?: string };
        if (cancelled) return;
        if (!res.ok || body.error) setError(body.error ?? 'Could not load proposal');
        else setProposal(body.data ?? null);
      } catch {
        if (!cancelled) setError('Connection error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#000' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '10px 20px',
          background: '#0cf574',
          color: '#000',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span>Draft preview — this is what the client sees. Not a shared link.</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {(['web', 'print'] as RenderMode[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              style={{
                border: '1.5px solid #000',
                background: mode === option ? '#000' : 'transparent',
                color: mode === option ? '#0cf574' : '#000',
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {option === 'web' ? 'Web' : 'Print'}
            </button>
          ))}
        </span>
      </div>

      {error && (
        <p style={{ padding: 24, color: '#fff', fontFamily: 'system-ui' }}>{error}</p>
      )}

      {proposal && (
        <div
          className={proposalFontClass}
          style={
            mode === 'print'
              ? { maxWidth: 816, margin: '0 auto', padding: '24px 0' }
              : undefined
          }
        >
          <ProposalRenderer
            blocks={proposal.blocks}
            theme={proposal.theme}
            mode={mode}
            currency={proposal.currency}
            totalCents={proposal.totalCents}
            lineItems={proposal.lineItems}
            imageUrls={proposal.imageUrls}
            headerNote={proposal.theme.headerNote}
          />
        </div>
      )}
    </div>
  );
}
