// Proposal typography.
//
// next/font downloads the face at build time and serves it from our own
// origin with a preloaded @font-face — there is no runtime request to
// fonts.googleapis.com. That is what the PDF renderer needs: headless Chrome
// resolves the font from the same deployment it is already loading the page
// from, with no external network dependency.
//
// One family carries both roles. Display type is set large and tight, with
// the full weight range loaded so the two heading lines can be set against
// each other; body type is 400/500 at reading size.
import { Bai_Jamjuree } from 'next/font/google';

const baiJamjuree = Bai_Jamjuree({
  weight: ['200', '300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-proposal',
  display: 'swap',
});

/** Attach to any element wrapping <ProposalRenderer />. */
export const proposalFontClass = baiJamjuree.variable;
