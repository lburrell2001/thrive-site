// src/app/work/[slug]/page.tsx
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseServer";
import styles from "./ProjectPage.module.css";

const BUCKET = "course-media";

function publicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return path;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export default async function ProjectSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  // IMPORTANT: show real error instead of fake 404 while building
  if (error) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.wrap}>
          <Link href="/work" className={styles.link}>
            ← Work
          </Link>
          <pre className={styles.mono} style={{ marginTop: 18, whiteSpace: "pre-wrap" }}>
            Supabase error: {error.message}
          </pre>
        </main>
      </div>
    );
  }

  // If slug truly doesn't exist in DB
  if (!project) return notFound();

  // Optional fields (won’t crash if they’re null/missing)
  const tagline = project.tagline ?? "";
  const overview = project.overview ?? "";
  const highlights: string[] = Array.isArray(project.highlights) ? project.highlights : [];
  const deliverables: string[] = Array.isArray(project.deliverables) ? project.deliverables : [];
  const tools: string[] = Array.isArray(project.tools) ? project.tools : [];
  const gallery: string[] = Array.isArray(project.gallery) ? project.gallery : [];

  const coverSrc = publicUrl(`projects/${project.slug}/cover.jpg`);

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.wrap}>
        <div className={styles.breadcrumb}>
          <Link href="/work" className={styles.link}>
            ← Work
          </Link>
        </div>

        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.pillRow}>
              <span className={styles.pill}>{project.category}</span>
            </div>

            <h1 className={styles.title}>{project.title}</h1>
            {tagline ? <p className={styles.tagline}>{tagline}</p> : null}

            <div className={styles.ctaRow}>
              <Link className={styles.btn} href="/work">
                View all projects
              </Link>
              <a className={styles.btnGhost} href="#gallery">
                Jump to gallery
              </a>
            </div>
          </div>

          <div className={styles.cover}>
            <img
              src={coverSrc}
              alt={`${project.title} cover`}
              className={styles.coverImg}
              style={{ width: "100%", height: "100%" }}
            />
            <div className={styles.coverGlow} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.body}>
          <article className={styles.left}>
            <h2 className={styles.h2}>Overview</h2>

            {overview ? (
              <p className={styles.p}>{overview}</p>
            ) : (
              <p className={styles.muted}>
                Add an <span className={styles.mono}>overview</span> column to the projects table to show the case study
                story here.
              </p>
            )}

            <div className={styles.divider} />

            <h2 className={styles.h2} id="gallery">
              Gallery
            </h2>

            {gallery.length ? (
              <div className={styles.gallery}>
                {gallery.map((file) => (
                  <div className={styles.shot} key={file}>
                    <img
                      src={publicUrl(`projects/${project.slug}/gallery/${file}`)}
                      alt={`${project.title} gallery`}
                      className={styles.shotImg}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>
                Gallery coming soon. Upload to{" "}
                <span className={styles.mono}>projects/{project.slug}/gallery/</span>
              </p>
            )}
          </article>

          <aside className={styles.right}>
            <div className={styles.panel}>
              <h3 className={styles.h3}>Highlights</h3>
              {highlights.length ? (
                <ul className={styles.list}>
                  {highlights.map((x: string) => (
                    <li key={x} className={styles.li}>
                      {x}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.mutedSmall}>Add a highlights[] column to show bullet points.</p>
              )}
            </div>

            <div className={styles.panel}>
              <h3 className={styles.h3}>Deliverables</h3>
              {deliverables.length ? (
                <ul className={styles.list}>
                  {deliverables.map((x: string) => (
                    <li key={x} className={styles.li}>
                      {x}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.mutedSmall}>Add a deliverables[] column to list what you shipped.</p>
              )}
            </div>

            <div className={styles.panelAlt}>
              <h3 className={styles.h3}>Tools</h3>
              {tools.length ? (
                <p className={styles.mutedSmall}>{tools.join(" · ")}</p>
              ) : (
                <p className={styles.mutedSmall}>Add a tools[] column for your stack.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
