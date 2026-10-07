import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "About Lauren Burrell — Dallas Web Designer & Brand Studio",
  description:
    "Meet Lauren Burrell, founder of Thrive Creative Studios — a Black-owned Dallas studio designing websites, brands and social media for small businesses ready to stand out.",
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
