import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact a Dallas Web Design & Branding Studio",
  description:
    "Start your website, branding or social media project with Thrive Creative Studios. Small businesses, creators and organizations across Dallas–Fort Worth and remotely across the US.",
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
