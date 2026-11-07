// Thrive's icons: light, rounded line icons in one colour (currentColor), so
// they sit on any card. Brand is the logo mark itself, kept solid.

import type { SVGProps } from 'react';

export type ThriveIconName =
  | 'brand' | 'web' | 'social' | 'ux' | 'photo' | 'care' | 'landing' | 'edit' | 'analytics' | 'mobile'
  | 'pen' | 'palette' | 'type' | 'book' | 'card' | 'folder' | 'calendar' | 'video' | 'hashtag' | 'send'
  | 'sitemap' | 'wireframe' | 'person' | 'box' | 'sparkle';

/** The shared stroke for the line icons: light and rounded, like the logo's soft corners. */
const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<ThriveIconName, React.ReactNode> = {
  // Brand: the Thrive logo mark itself (flower and T, from logo-mark.svg), in one colour.
  brand: (
    <g fill="currentColor" transform="translate(13.1 2) scale(0.2486)">
      <path d="M40.53,177.02c-3.52,0-5.06-1.55-5.06-5.06l.48-75.85H5.06c-3.52,0-5.06-1.55-5.06-5.06v-17.02c0-3.52,1.55-5.06,5.06-5.06h93.72c3.52,0,5.06,1.55,5.06,5.06v17.02c0,3.52-1.55,5.06-5.06,5.06h-29.93l-.48,75.85c0,3.52-1.55,5.06-5.07,5.06h-22.79Z" />
      <path d="M45.36,39.31h15.01c2.55,0,4.62,2.07,4.62,4.62v15.52c0,2.55-2.07,4.62-4.62,4.62h-15.01c-2.55,0-4.62-2.07-4.62-4.62v-15.52c0-2.55,2.07-4.62,4.62-4.62Z" />
      <path d="M71.91,58.86c-2.95-1.25-4.13-1.92-4.13-5.13v-3.86c0-3.21,1.27-3.83,4.19-5.15,9.09-4.09,17.08-5.84,27.26-5.42,3.2.13,4.62,1.41,4.62,4.62v14.47c0,3.21-1.41,4.47-4.62,4.62-9.86.47-18.54-.42-27.32-4.16Z" />
      <path d="M59.14,31.94c-1.25,2.95-1.92,4.13-5.13,4.13h-3.86c-3.21,0-3.83-1.27-5.15-4.19-4.09-9.09-5.84-17.08-5.42-27.26C39.72,1.41,41,0,44.21,0h14.47c3.21,0,4.47,1.41,4.62,4.62.47,9.86-.42,18.54-4.16,27.32Z" />
      <path d="M73.34,40.47c-3.01,1.11-4.33,1.42-6.52-.92l-2.64-2.81c-2.19-2.34-1.7-3.66-.47-6.62,3.83-9.2,8.46-15.95,16.17-22.61,2.43-2.1,4.33-2.13,6.53.21l9.9,10.55c2.19,2.34,2.03,4.22-.21,6.53-6.87,7.09-13.81,12.38-22.77,15.67Z" />
      <path d="M31.94,58.86c2.95-1.25,4.13-1.92,4.13-5.13v-3.86c0-3.21-1.27-3.83-4.19-5.15-9.09-4.09-17.08-5.84-27.26-5.42C1.41,39.44,0,40.72,0,43.93v14.47c0,3.21,1.41,4.47,4.62,4.62,9.86.47,18.54-.42,27.32-4.16Z" />
      <path d="M30.51,40.47c3.01,1.11,4.33,1.42,6.52-.92l2.64-2.81c2.19-2.34,1.7-3.66.47-6.62-3.83-9.2-8.46-15.95-16.17-22.61-2.43-2.1-4.33-2.13-6.53.21l-9.9,10.55c-2.19,2.34-2.03,4.22.21,6.53,6.87,7.09,13.81,12.38,22.77,15.67Z" />
    </g>
  ),
  // The rest are line icons: one light, rounded stroke (see LINE below), so
  // they sit quietly next to the bold type.
  // Web development: a browser window with code brackets.
  web: (
    <g {...LINE}>
      <rect x="5" y="8" width="38" height="32" rx="5" />
      <path d="M5 16h38" />
      <path d="M19 22l-5 5 5 5M29 22l5 5-5 5M26 21l-4 12" />
    </g>
  ),
  // Social media: a speech bubble with a heart.
  social: (
    <g {...LINE}>
      <path d="M12 7h24a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H22l-8 6.5V34h-2a6 6 0 0 1-6-6V13a6 6 0 0 1 6-6Z" />
      <path d="M24 27.5l-5.2-5.1a3.4 3.4 0 0 1 4.8-4.8l.4.4.4-.4a3.4 3.4 0 0 1 4.8 4.8Z" />
    </g>
  ),
  // UX/UI: a phone with a screen layout, and a cursor.
  ux: (
    <g {...LINE}>
      <rect x="6" y="4" width="21" height="40" rx="5" />
      <path d="M12 13h9M12 19h5" />
      <path d="M31 24l12 5-5 1.8-1.8 5Z" />
    </g>
  ),
  // Photography: a camera with a round lens.
  photo: (
    <g {...LINE}>
      <path d="M17.5 11l2-3.5h9l2 3.5H38a5 5 0 0 1 5 5v18a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V16a5 5 0 0 1 5-5Z" />
      <circle cx="24" cy="25" r="8" />
      <path d="M36.5 17h1" />
    </g>
  ),
  // Care plans: a shield with a heart.
  care: (
    <g {...LINE}>
      <path d="M24 5l15 5.5v11c0 9.5-6.2 16-15 21-8.8-5-15-11.5-15-21v-11Z" />
      <path d="M24 28l-4.6-4.5a3 3 0 0 1 4.2-4.2l.4.4.4-.4a3 3 0 0 1 4.2 4.2Z" />
    </g>
  ),
  // Landing pages: one page with a headline, a line of text and a button.
  landing: (
    <g {...LINE}>
      <rect x="10" y="4" width="28" height="40" rx="5" />
      <path d="M16 12h16M16 18h10" />
      <rect x="16" y="27" width="16" height="7" rx="3.5" />
    </g>
  ),
  // Edit it yourself: a pencil.
  edit: (
    <g {...LINE}>
      <path d="M31 7.5a3.5 3.5 0 0 1 5 0l4.5 4.5a3.5 3.5 0 0 1 0 5L18 39.5 8 41l1.5-10Z" />
      <path d="M27 11.5l9.5 9.5M26 41h15" />
    </g>
  ),
  // Forms, analytics & SEO: three rising bars on a baseline.
  analytics: (
    <g {...LINE}>
      <rect x="8" y="25" width="7" height="14" rx="2" />
      <rect x="20.5" y="16" width="7" height="23" rx="2" />
      <rect x="33" y="8" width="7" height="31" rx="2" />
      <path d="M5 43h38" />
    </g>
  ),
  // Mobile-first: a phone with its home bar.
  mobile: (
    <g {...LINE}>
      <rect x="13" y="4" width="22" height="40" rx="5" />
      <path d="M21 38h6" />
    </g>
  ),
  // Logo design: a pen nib.
  pen: (
    <g {...LINE}>
      <path d="M24 6l12 14-12 22L12 20Z" />
      <path d="M24 6v18" />
      <circle cx="24" cy="26" r="2.5" />
    </g>
  ),
  // Color system: a palette with paint spots.
  palette: (
    <g {...LINE}>
      <path d="M24 6C13.5 6 6 13.5 6 23s7.5 19 16 19c3 0 4.5-1.8 4.5-4 0-2.6-2.2-3.5-2.2-6 0-2.4 2-4 4.6-4H34c5 0 8-3.5 8-8C42 12 34 6 24 6Z" />
      <circle cx="15" cy="21" r="2.4" /><circle cx="22" cy="14" r="2.4" /><circle cx="31.5" cy="15.5" r="2.4" />
    </g>
  ),
  // Typography: a capital A and a lowercase a.
  type: (
    <g {...LINE}>
      <path d="M6 38l9.5-28h1L26 38M9.5 28h13" />
      <path d="M41 38V27a5 5 0 0 0-9.4-2.4M41 31.5c-6.5-.5-10 1.2-10 3.8 0 2.2 1.8 3.2 3.8 3.2 3.6 0 6.2-3 6.2-7" />
    </g>
  ),
  // Brand guidelines: an open book.
  book: (
    <g {...LINE}>
      <path d="M24 12c-4-3-10-4-17-3v28c7-1 13 0 17 3 4-3 10-4 17-3V9c-7-1-13 0-17 3Z" />
      <path d="M24 12v28" />
    </g>
  ),
  // Social & print pieces: a business card.
  card: (
    <g {...LINE}>
      <rect x="5" y="11" width="38" height="26" rx="4" />
      <circle cx="16" cy="22" r="4" />
      <path d="M26 20h11M26 26h8M11 31h26" />
    </g>
  ),
  // Final files / licensed deliverables: a folder.
  folder: (
    <g {...LINE}>
      <path d="M5 14a4 4 0 0 1 4-4h9l4 4h17a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M5 20h38" />
    </g>
  ),
  // Content calendar.
  calendar: (
    <g {...LINE}>
      <rect x="6" y="9" width="36" height="33" rx="5" />
      <path d="M6 18h36M16 5v8M32 5v8" />
      <path d="M14 26h4M22 26h4M30 26h4M14 33h4M22 33h4" />
    </g>
  ),
  // Design & video editing: a play button in a frame.
  video: (
    <g {...LINE}>
      <rect x="5" y="10" width="38" height="28" rx="5" />
      <path d="M21 18v12l9-6Z" />
    </g>
  ),
  // Captions & hashtags.
  hashtag: (
    <g {...LINE}>
      <path d="M19 6l-4 36M33 6l-4 36M8 17h34M6 31h34" />
    </g>
  ),
  // Scheduling & posting: a paper plane.
  send: (
    <g {...LINE}>
      <path d="M42 6L5 21l14 6 6 14Z" />
      <path d="M19 27l10-10" />
    </g>
  ),
  // Information architecture: a sitemap.
  sitemap: (
    <g {...LINE}>
      <rect x="18" y="5" width="12" height="9" rx="2.5" />
      <rect x="5" y="34" width="12" height="9" rx="2.5" /><rect x="18" y="34" width="12" height="9" rx="2.5" /><rect x="31" y="34" width="12" height="9" rx="2.5" />
      <path d="M24 14v10M11 34v-6h26v6M24 24v10" />
    </g>
  ),
  // Wireframes: a page blocked out in boxes.
  wireframe: (
    <g {...LINE}>
      <rect x="5" y="7" width="38" height="34" rx="4" />
      <rect x="10" y="12" width="28" height="8" rx="1.5" />
      <rect x="10" y="25" width="12" height="11" rx="1.5" />
      <path d="M27 26h11M27 31h11M27 36h7" />
    </g>
  ),
  // Headshots: a person.
  person: (
    <g {...LINE}>
      <circle cx="24" cy="16" r="8" />
      <path d="M9 42c0-8 6.7-13 15-13s15 5 15 13" />
    </g>
  ),
  // Product photography: a box.
  box: (
    <g {...LINE}>
      <path d="M24 5l17 8.5v21L24 43 7 34.5v-21Z" />
      <path d="M7 13.5L24 22l17-8.5M24 22v21" />
    </g>
  ),
  // Retouching & editing / event moments: a sparkle.
  sparkle: (
    <g {...LINE}>
      <path d="M22 6c1.4 8.6 4.4 11.6 13 13-8.6 1.4-11.6 4.4-13 13-1.4-8.6-4.4-11.6-13-13 8.6-1.4 11.6-4.4 13-13Z" />
      <path d="M37 30c.6 3.5 1.9 4.8 5 5.5-3.1.7-4.4 2-5 5.5-.6-3.5-1.9-4.8-5-5.5 3.1-.7 4.4-2 5-5.5Z" />
    </g>
  ),
};

export function ThriveIcon({ name, ...props }: { name: ThriveIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden {...props}>
      {ICONS[name]}
    </svg>
  );
}
