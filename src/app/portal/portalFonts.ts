// The portal's type, matching the public site (Nov 2026): Poppins only.
// Pages style text inline with var(--font-bungee) for headings and
// var(--font-inter) for everything else (names kept from the old fonts), so
// both variables now point at Poppins: headings get a Bold-only face (any
// weight asked for renders Bold), text gets Medium, SemiBold and Bold.

import { Poppins } from 'next/font/google';

const display = Poppins({ weight: '700', subsets: ['latin'], variable: '--font-bungee', display: 'swap' });
const text = Poppins({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const portalFonts = `${display.variable} ${text.variable}`;
