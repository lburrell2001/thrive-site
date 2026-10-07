import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Web Design, Branding & Social Media in Dallas, TX",
  description:
    "Affordable web design, branding, social media management, UX design and brand photography for small businesses — from a Dallas studio, in person across DFW and remote across the US.",
  path: "/services",
  keywords: [
    "branding services Dallas TX",
    "web design services",
    "UX design studio",
    "social media management Dallas TX",
    "brand identity design",
    "photography Dallas TX",
    "creative services Texas",
  ],
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
