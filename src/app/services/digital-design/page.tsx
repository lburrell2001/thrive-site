import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import Shell from "../../_site/Shell";
import ServicePage from "../../_site/services/ServicePage";

// The digital-design service page (Nov 2026 redesign). Copy lives in
// src/app/_site/services/configs.ts, prices in servicePricing.ts, the longer
// read and FAQs in serviceSeo.ts.

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["digital-design"].title,
  description: SERVICE_SEO["digital-design"].description,
  path: "/services/digital-design",
  keywords: [
    "web design Dallas TX",
    "affordable web design Dallas",
    "small business website design",
    "landing page design Texas",
    "digital design studio",
    "website design small business",
    "digital assets design",
  ],
});

// Approved reviews show up without a redeploy.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Shell>
      <ServicePage slug="digital-design" />
    </Shell>
  );
}
