import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description:
    "Meet Lauren Burrell and the Thrive Creative Studios team — a Dallas-based creative studio building bold brands, websites, and social media content for businesses ready to stand out.",
  path: "/about",
  keywords: [
    "about Thrive Creative Studios",
    "Lauren Burrell designer",
    "Dallas creative studio",
    "Dallas branding agency",
    "Black-owned creative studio",
  ],
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
