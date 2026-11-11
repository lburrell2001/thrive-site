import type { Metadata } from 'next';
import '@/styles/proposal-chrome.css';
import './estimate-page.css';
import { proposalFontClass } from '@/lib/proposalFonts';

/** Estimates are private documents reached by a secret link: never indexed. */
export const metadata: Metadata = {
  title: 'Your estimate',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`proposalChrome estimatePage ${proposalFontClass}`} style={{ minHeight: '100dvh' }}>
      {children}
    </div>
  );
}
