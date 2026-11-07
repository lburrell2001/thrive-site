import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SERVICE_SEO } from "@/lib/serviceSeo";
import Shell from "../../_site/Shell";
import ServicePage from "../../_site/services/ServicePage";

// The ux-design service page (Nov 2026 redesign). Copy lives in
// src/app/_site/services/configs.ts, prices in servicePricing.ts, the longer
// read and FAQs in serviceSeo.ts.

export const metadata: Metadata = buildPageMetadata({
  title: SERVICE_SEO["ux-design"].title,
  description: SERVICE_SEO["ux-design"].description,
  path: "/services/ux-design",
  keywords: [
    "UX design Dallas TX",
    "product design Texas",
    "user experience design studio",
    "wireframe design",
    "Figma prototyping",
  ],
});

// Approved reviews show up without a redeploy.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Shell>
      <ServicePage slug="ux-design" />
    </Shell>
  );
}
