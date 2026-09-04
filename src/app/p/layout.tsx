import type { Metadata } from 'next';
import '@/styles/proposal-chrome.css';
import { proposalFontClass } from '@/lib/proposalFonts';

/**
 * Proposals are private documents reached by a secret link. They must never
 * be indexed, previewed by a crawler, or summarised in a search result.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`proposalChrome ${proposalFontClass}`}
      style={{ background: '#000', minHeight: '100dvh' }}
    >
      {children}
    </div>
  );
}
