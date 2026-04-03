import type { Metadata } from "next";
import { supabase } from "@/lib/supabaseServer";
import { buildPageMetadata } from "@/lib/seo";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = buildPageMetadata({
  title: "Portfolio",
  description:
    "Browse work by Thrive Creative Studios — bold brand identities, websites, UX designs, and social media content built for businesses that refuse to blend in.",
  path: "/portfolio",
  keywords: [
    "design portfolio",
    "branding portfolio Dallas TX",
    "web design portfolio",
    "UX design portfolio",
    "creative studio work",
  ],
});

export default async function PortfolioPage() {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, slug, category, tagline")
    .order("order_index", { ascending: true });

  return <PortfolioClient projects={projects ?? []} />;
}
