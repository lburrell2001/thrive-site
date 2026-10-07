import { NextResponse } from "next/server";
import { loadReelProjects } from "@/lib/workReel";

// Public list of projects for the WorkReel strip on client-rendered pages.
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json({ projects: await loadReelProjects() });
}
