// src/app/work/page.tsx
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "@/lib/supabaseServer";
import styles from "./WorkPage.module.css";

const BUCKET = "course-media";

function publicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return path;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export default async function WorkPage() {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,title,slug,category,span,order_index,published")
    .eq("published", true)
    .order("order_index", { ascending: true });

  if (error) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.wrap}>
          <h1 className={styles.title}>Work</h1>
          <p className={styles.sub}>Supabase error: {error.message}</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.wrap}>
        {/* Intro */}
        <section className={styles.hero}>
          <p className={styles.kicker}>Selected work</p>
          <h1 className={styles.heroTitle}>Projects that feel like a gallery wall.</h1>
          <p className={styles.heroText}>
            A curated selection spanning branding, UX, product concepts, and content.
          </p>
        </section>

        {/* Grid */}
        <section className={styles.wall} aria-label="Work gallery">
          <div className={styles.grid}>
            {projects?.map((p) => (
              <Link
                key={p.id}
                href={`/work/${p.slug}`}
                className={`${styles.tile} ${styles[p.span as keyof typeof styles] ?? ""}`}
                aria-label={`View ${p.title}`}
              >
                <span className={styles.bg} aria-hidden="true" />
                <img
                  src={publicUrl(`projects/${p.slug}/cover.jpg`)}
                  alt={`${p.title} cover`}
                  className={styles.img}
                  loading="lazy"
                />
                <div className={styles.label}>
                  <span className={styles.cat}>{p.category}</span>
                  <span className={styles.name}>{p.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
