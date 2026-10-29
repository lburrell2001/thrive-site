import type { Metadata } from "next";
import { supabase } from "@/lib/supabaseServer";
import { buildPageMetadata } from "@/lib/seo";
import PortfolioClient from "./PortfolioClient";

// Always read fresh project data from Supabase so admin-added projects appear immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Web Development & Branding Portfolio — Dallas, TX",
  description:
    "Work that refuses to blend in: brand identities, websites, UX designs and social media content by Thrive Creative Studios in Dallas, TX.",
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
  const { data } = await supabase
    .from("projects")
    .select("id, title, slug, category, tagline, featured, problem, solution, results")
    .order("order_index", { ascending: true });
  const projects = (data ?? []) as {
    id: string; title: string; slug: string; category: string | null; tagline: string | null;
    featured: boolean | null; problem: string | null; solution: string | null; results: string | null;
  }[];

  // The case study teaser: a project with its problem, solution and result all
  // written — the one marked featured if it has them, otherwise the first.
  const complete = projects.filter((p) => p.problem && p.solution && p.results);
  const caseStudy = complete.find((p) => p.featured) ?? complete[0] ?? null;

  return (
    <PortfolioClient
      projects={projects.map(({ id, title, slug, category, tagline }) => ({ id, title, slug, category, tagline }))}
      caseStudy={caseStudy && {
        title: caseStudy.title, slug: caseStudy.slug, category: caseStudy.category,
        problem: caseStudy.problem!, solution: caseStudy.solution!, results: caseStudy.results!,
      }}
    />
  );
}
