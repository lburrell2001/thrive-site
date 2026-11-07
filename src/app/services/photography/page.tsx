import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import Shell from "../../_site/Shell";
import ServicePage from "../../_site/services/ServicePage";

// The photography service page (Nov 2026 redesign). Copy lives in
// src/app/_site/services/configs.ts, prices in servicePricing.ts, the longer
// read and FAQs in serviceSeo.ts.

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["photography"].title,
  description: SERVICE_SEO["photography"].description,
  path: "/services/photography",
  keywords: [
    "brand photography Dallas TX",
    "business photography Texas",
    "headshot photography studio",
    "product photography Dallas TX",
    "brand visual storytelling",
  ],
});

// Approved reviews show up without a redeploy.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Shell>
      <ServicePage slug="photography" />
    </Shell>
  );
}
