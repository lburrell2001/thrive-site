import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import Shell from "../../_site/Shell";
import ServicePage from "../../_site/services/ServicePage";

// The social-media service page (Nov 2026 redesign). Copy lives in
// src/app/_site/services/configs.ts, prices in servicePricing.ts, the longer
// read and FAQs in serviceSeo.ts.

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["social-media"].title,
  description: SERVICE_SEO["social-media"].description,
  path: "/services/social-media",
  keywords: [
    "social media management Dallas TX",
    "content creation Texas",
    "Instagram management studio",
    "social media strategy small business",
  ],
});

// Approved reviews show up without a redeploy.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Shell>
      <ServicePage slug="social-media" />
    </Shell>
  );
}
