import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Branding, Web Design & Creative Services in Dallas, TX",
  description:
    "Brand identity, website design, UX design, social media management and brand photography from a Dallas creative studio — in person across DFW, remote across the US.",
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
