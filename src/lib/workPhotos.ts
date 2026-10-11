// Real project photos for the PhotoStrip bands around the site, grouped by
// service. Alt text is copied from the case studies (src/app/work/case-studies).
// Only real work — never stock — and one print per project, so a band never
// makes one client look like several.

import type { ServiceSlug } from "./serviceSeo";
import { storageUrl } from "./storage";

export type WorkPhoto = {
  src: string; alt: string; caption: string; href: string;
  /** object-position for the square crop, e.g. "top" for a tall phone screenshot. */
  position?: string;
};

const cs = (slug: string, file: string) => `/case-studies/${slug}/${file}`;
const grad = (file: string) => storageUrl(`projects/2026-graduation-pictures/gallery/${file}`);

export const WORK_PHOTOS: Record<ServiceSlug, WorkPhoto[]> = {
  "digital-design": [
    { src: cs("the-burrell-group", "mockup-screens.webp"), alt: "Five pages of The Burrell Group website floating above a laptop", caption: "The Burrell Group", href: "/work/the-burrell-group" },
    { src: cs("classic-rollers-car-club", "mockup-screens.webp"), alt: "Classic Rollers Car Club website on a desktop monitor with its pages and mobile home page floating around it", caption: "Classic Rollers Car Club", href: "/work/classic-rollers-car-club" },
  ],
  "social-media": [
    { src: cs("roots-to-wellness-social-media-management-graphics-creation", "post-fresh-harvest.webp"), alt: "Gloved hands lifting radishes and greens into a wooden crate", caption: "Roots to Wellness", href: "/work/roots-to-wellness-social-media-management-graphics-creation" },
    { src: cs("dallas-derby-day", "post-perfect-pair.webp"), alt: "A cigar resting on a glass of tequila with “Experience the perfect pair on the perfect Derby Day” and the Flecha Azul Tequila × The Cigar Bar Experience logos", caption: "Dallas Derby Day", href: "/work/dallas-derby-day" },
    { src: cs("thrive-social-media-management-graphics-creation", "spotlight-mastamind-01.webp"), alt: "“Client spotlight” cover slide with the Mastamind brain-and-headphones logo over a black-and-white concert crowd", caption: "Thrive social", href: "/work/thrive-social-media-management-graphics-creation" },
  ],
  "ux-design": [
    { src: cs("soulcheck", "screens.webp"), alt: "“SoulCheck x Thrive” graphic with three phones: the journal with a Guided/Free switch, the June and May mood calendars, and the delete-account screen with a Face ID prompt", caption: "SoulCheck", href: "/work/soulcheck" },
    { src: cs("safespace", "ipad-notes.webp"), alt: "Two iPads with the redesigned dark green app; the front one lists a patient's dated session notes", caption: "SafeSpace", href: "/work/safespace" },
    { src: cs("tckt", "phone-showtimes.webp"), alt: "Cineapolis Luxury Cinema showtimes: a day picker across the top and three films, each with four showtime buttons", caption: "TCKT", href: "/work/tckt" },
  ],
  "brand-design": [
    { src: cs("dj-mastamind", "poster-mastamind.webp"), alt: "Poster with MAS / TA / MIND stacked in navy-purple letters outlined in white and red, the brain-and-headphones mark breaking through the type over a dark brain pattern", caption: "DJ Mastamind", href: "/work/dj-mastamind" },
    { src: cs("brewhaus", "bag-and-cup.webp"), alt: "A lavender BrewHaus bag covered in the bean pattern with a large logo mark, next to a matching to-go cup", caption: "BrewHaus", href: "/work/brewhaus" },
    { src: cs("curl-and-co", "bottles.webp"), alt: "Two cream pump bottles, Mango–Agave Shampoo and Lemon–Aloe Conditioner, each with the Curl & Co. logo in cream on a dark brown circle", caption: "Curl & Co.", href: "/work/curl-and-co" },
    { src: cs("squeeze-shop", "can-mockup.webp"), alt: "Two pink Strawberry & Peach Lemonade cans, one standing and one on its side, on a pale pink lemon pattern", caption: "The Squeeze Shop", href: "/work/squeeze-shop" },
  ],
  photography: [
    { src: grad("1775064259694-Untitled-3.png"), alt: "Close-up of the graduate laughing in an olive corduroy shirt, holding a cap with its red 2026 tassel beside their face, on a warm neutral backdrop", caption: "Warm neutral", href: "/work/2026-graduation-pictures" },
    { src: storageUrl("work/2026-graduation-pictures-cover.jpg"), alt: "Profile portrait in cap and red 2026 tassel against a bright red backdrop", caption: "Red backdrop", href: "/work/2026-graduation-pictures" },
    { src: grad("1775064580831-IMG_1252.jpg"), alt: "Side profile in cap, white collar and red tie against a dark brown backdrop, lit warmly from the front", caption: "Low-key profile", href: "/work/2026-graduation-pictures" },
    { src: grad("1775064582554-IMG_1239.jpg"), alt: "Full-length portrait of the graduate seated on a vintage suitcase in a dark jacket, red tie, jeans and loafers, smiling under a soft spotlight", caption: "Full length", href: "/work/2026-graduation-pictures" },
  ],
};

/** One photo from each service, then a second round — for pages about the studio as a whole. */
export function mixedPhotos(count = 5): WorkPhoto[] {
  const sets = Object.values(WORK_PHOTOS);
  const out: WorkPhoto[] = [];
  for (let round = 0; out.length < count && round < 4; round++) {
    for (const set of sets) if (set[round] && out.length < count) out.push(set[round]);
  }
  return out;
}
