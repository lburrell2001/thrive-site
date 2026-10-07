import { supabase } from "@/lib/supabaseServer";

export type ReelProject = { slug: string; title: string; category: string | null };

/** Projects shown in the WorkReel strip, in portfolio order. Never throws. */
export async function loadReelProjects(): Promise<ReelProject[]> {
  try {
    const { data } = await supabase
      .from("projects")
      .select("slug, title, category")
      .order("order_index", { ascending: true });
    return (data ?? []) as ReelProject[];
  } catch {
    return [];
  }
}
