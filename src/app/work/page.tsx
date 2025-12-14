// src/app/work/page.tsx
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import styles from "./WorkPage.module.css";

import { supabase } from "../../lib/supabaseServer";

type WorkProject = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  span: string | null;
};

const BUCKET = "course-media";

// If you already have a publicUrl helper elsewhere, you can remove this and import yours.
function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default async function WorkPage() {
  const { data, error } = await supabase
    .from("projects")
    .select("id,title,slug,category,span")
    .order("title", { ascending: true });

  if (error) {
    // You can make this prettier later; this prevents hard build failures.
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
              className={`${styles.tile} ${p.span ? (styles[p.span as keyof typeof styles] ?? "") : ""}`}
              aria-label={`View ${p.title}`}
            >
              <span className={styles.bg} aria-hidden="true" />

              {/* Use Next Image so it’s optimized, but still works with your Supabase public URL */}
              <Image
                src={publicUrl(`projects/${p.slug}/cover.jpg`)}
                alt={`${p.title} cover`}
                fill
                className={styles.img}
                sizes="(max-width: 920px) 100vw, 50vw"
                priority={false}
              />

              <div className={styles.label}>
                <span className={styles.cat}>{p.category ?? ""}</span>
                <span className={styles.name}>{p.title}</span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
