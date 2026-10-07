// Long-form case studies for /work/[slug]. A project with an entry here gets
// the full case-study layout (CaseStudy.tsx) instead of the short overview.
// One file per project in ./case-studies/<slug>.ts, registered in CASE_STUDIES.
// Everything in an entry must be true and checkable — from the project record,
// the delivered files, the client's live site or its code history. No invented
// metrics or quotes: leave `quote` out until the client has given one.
//
// Image src: a public path ("/case-studies/<slug>/x.webp") or "storage:<path>"
// for a file in the course-media bucket (served resized, see caseImageUrl).

export type CaseImage = { src: string; alt: string; caption?: string };

export type CaseShowcase = {
  title: string;
  text?: string;
  images: CaseImage[];
  /** grid: even tiles · wide: one image per row · phones: phone frames · posts: tilted social posts */
  layout?: "grid" | "wide" | "phones" | "posts";
};

/** Every section except the header is optional; the section menu only lists what's there. */
export type CaseStudy = {
  slug: string;
  client: string;
  headline: string;
  lede: string;
  liveUrl?: string;
  meta: { label: string; value: string }[];
  /** Big image under the overview; defaults to nothing. */
  heroImage?: CaseImage;
  numbers?: { value: string; label: string }[];
  about: string[];
  challenge?: { intro: string; goals?: { title: string; text: string }[] };
  approach?: { intro?: string; steps: { title: string; text: string }[] };
  pages?: { title: string; text: string; desktop: CaseImage; mobile?: CaseImage }[];
  showcase?: CaseShowcase[];
  features?: { title: string; text: string }[];
  design?: {
    intro: string;
    colors?: { name: string; hex: string }[];
    type?: string;
    patterns?: { title: string; text: string }[];
    fullPages?: CaseImage[];
  };
  timeline?: { when: string; title: string; text: string }[];
  mobile?: { intro: string; shots: CaseImage[] };
  outcome: string[];
  quote?: { text: string; author: string };
  stack?: string[];
};

import p2026GraduationPictures from "./case-studies/2026-graduation-pictures";
import brewhaus from "./case-studies/brewhaus";
import curlAndCo from "./case-studies/curl-and-co";
import dallasDerbyDay from "./case-studies/dallas-derby-day";
import djMastamind from "./case-studies/dj-mastamind";
import rootsToWellnessSocialMediaManagementGraphicsCreation from "./case-studies/roots-to-wellness-social-media-management-graphics-creation";
import safespace from "./case-studies/safespace";
import soulcheck from "./case-studies/soulcheck";
import squeezeShop from "./case-studies/squeeze-shop";
import tckt from "./case-studies/tckt";
import theBurrellGroup from "./case-studies/the-burrell-group";
import thriveSite from "./case-studies/thrive-site";
import thriveSocialMediaManagementGraphicsCreation from "./case-studies/thrive-social-media-management-graphics-creation";

export const CASE_STUDIES: Record<string, CaseStudy> = Object.fromEntries(
  [p2026GraduationPictures, brewhaus, curlAndCo, dallasDerbyDay, djMastamind, rootsToWellnessSocialMediaManagementGraphicsCreation, safespace, soulcheck, squeezeShop, tckt, theBurrellGroup, thriveSite, thriveSocialMediaManagementGraphicsCreation].map((cs) => [cs.slug, cs]),
);
