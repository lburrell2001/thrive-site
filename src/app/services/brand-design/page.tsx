import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import Shell from "../../_site/Shell";
import ServicePage from "../../_site/services/ServicePage";

// The brand-design service page (Nov 2026 redesign). Copy lives in
// src/app/_site/services/configs.ts, prices in servicePricing.ts, the longer
// read and FAQs in serviceSeo.ts.

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["brand-design"].title,
  description: SERVICE_SEO["brand-design"].description,
  path: "/services/brand-design",
  keywords: [
    "brand design Dallas TX",
    "logo design Texas",
    "visual identity design",
    "brand guidelines",
    "brand kit studio",
  ],
});

// Approved reviews show up without a redeploy.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Shell>
      <ServicePage slug="brand-design" />
    </Shell>
  );
}
