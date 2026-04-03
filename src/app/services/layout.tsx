import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Services",
  description:
    "Thrive Creative Studios offers brand design, digital design, UX design, social media management, and photography — everything your business needs to look and show up boldly.",
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
