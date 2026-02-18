import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Graphics Creation",
    description:
      "Graphics creation services are now included in Social Media Management + Graphics Creation.",
    path: "/services/social-media-management",
  }),
  robots: {
    index: false,
    follow: true,
  },
};

export default function GraphicsCreationRedirectPage() {
  redirect("/services/social-media-management");
}
