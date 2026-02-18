// src/app/work/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import styles from "./WorkPage.module.css";
import SiteFooter from "../components/SiteFooter";

import { supabase } from "../../lib/supabaseServer";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Portfolio",
  description:
    "View portfolio projects by Thrive Creative Studios across branding, UX/UI, web design, and social media graphics.",
  path: "/work",
  keywords: [
    "design portfolio",
    "branding portfolio",
    "UX portfolio",
    "social media graphics portfolio",
  ],
});

type WorkProject = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  span: string | null;
};

const BUCKET = "course-media";

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default async function WorkPage() {
  const { data, error } = await supabase
    .from("projects")
    .select("id,title,slug,category,span")
    .order("title", { ascending: true });

  if (error) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <div className={styles.wrap}>
          <h1 className={styles.h1}>Work</h1>
          <p className={styles.muted}>Could not load projects right now.</p>
        </div>
      </div>
    );
  }

  const projects: WorkProject[] = (data ?? []) as WorkProject[];

  return (
    <div className={styles.page}>
      <SiteHeader />

      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Work</h1>
          <p className={styles.sub}>
            A selection of branding, UX/UI, and web builds from Thrive Creative Studios.
          </p>
        </header>

        <section className={styles.grid} aria-label="Project gallery">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/work/${p.slug}`}
              className={styles.tile}
              aria-label={`View ${p.title}`}
            >
              <div className={styles.media}>
                <Image
                  src={publicUrl(`projects/${p.slug}/cover.jpg`)}
                  alt={`${p.title} cover`}
                  width={1400}
                  height={900}
                  className={styles.img}
                  sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, 33vw"
                />
                <span className={styles.bg} aria-hidden="true" />
                <div className={styles.label}>
                  <span className={styles.cat}>{p.category ?? ""}</span>
                  <span className={styles.name}>{p.title}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
