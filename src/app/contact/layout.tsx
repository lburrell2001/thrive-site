import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Ready to start your project? Get in touch with Thrive Creative Studios. We work with small businesses, creators, and organizations across Dallas, TX and remotely throughout the US.",
  path: "/contact",
  keywords: [
    "contact Thrive Creative Studios",
    "hire Dallas designer",
    "book branding studio",
    "start a design project",
    "Dallas creative agency contact",
  ],
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
