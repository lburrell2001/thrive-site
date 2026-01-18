// src/app/work/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import ProjectGallery from "./ProjectGallery";
import styles from "./ProjectPage.module.css";

import { supabase } from "../../../lib/supabaseServer";

type Project = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  span: string | null;

  // Optional fields (add these columns in Supabase when ready)
  tagline?: string | null;
  description?: string | null;
  role?: string | null;
  year?: string | null;
  website_url?: string | null;
  repo_url?: string | null;
  tools?: string[] | null;

  overview?: string | null;
project_notes?: string | null;
problem?: string | null;
solution?: string | null;
results?: string | null;

};

const BUCKET = "course-media";

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default async function ProjectSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Project>();

  if (error || !project) notFound();

  // Cover image
  const coverSrc = publicUrl(`projects/${project.slug}/cover.jpg`);

  // Gallery images (requires storage.objects select policy for listing)
  const galleryFolder = `projects/${project.slug}/gallery`;
  const { data: files } = await supabase.storage.from(BUCKET).list(galleryFolder, { limit: 100 });

  const galleryItems =
    files?.length
      ? files
          .filter((f) => f.name && !f.name.startsWith("."))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((f) => ({
            url: publicUrl(`${galleryFolder}/${f.name}`),
            alt: `${project.title} gallery image`,
          }))
      : [];

  // Prev/Next nav
  const { data: all } = await supabase
    .from("projects")
    .select("title, slug, category")
    .order("title", { ascending: true });

  const list = (all ?? []) as Array<{ title: string; slug: string; category: string | null }>;
  const idx = list.findIndex((p) => p.slug === project.slug);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  // Content fallbacks (no database/dev text)
  const description =
    project.description ??
    "Case study content coming soon. I’m building this out with process, decisions, and final outcomes.";

  return (
    <div className={styles.page}>
      <SiteHeader />

      <div className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link className={styles.link} href="/work">
            ← Back to work
          </Link>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.pillRow}>
              <span className={styles.pill}>{project.category ?? "Project"}</span>
              {project.year ? (
                <>
                  <span className={styles.dot} />
                  <span className={styles.meta}>{project.year}</span>
                </>
              ) : null}
            </div>

            <h1 className={styles.title}>{project.title}</h1>

            {/* ✅ FIX: no undefined tagline variable */}
            {project.tagline ? <p className={styles.tagline}>{project.tagline}</p> : null}

            <div className={styles.metaGrid}>
              {project.role ? (
                <div className={styles.card}>
                  <p className={styles.cardLabel}>Role</p>
                  <p className={styles.cardValue}>{project.role}</p>
                </div>
              ) : null}

              {project.tools?.length ? (
                <div className={styles.card}>
                  <p className={styles.cardLabel}>Tools</p>
                  <p className={styles.cardValue}>{project.tools.join(" · ")}</p>
                </div>
              ) : null}
            </div>

            <div className={styles.ctaRow}>
              {project.website_url ? (
                <a className={styles.btn} href={project.website_url} target="_blank" rel="noreferrer">
                  Visit live site
                </a>
              ) : null}

              {project.repo_url ? (
                <a className={styles.btnGhost} href={project.repo_url} target="_blank" rel="noreferrer">
                  View repo
                </a>
              ) : null}
            </div>
          </div>

          <div className={styles.cover}>
            <img src={coverSrc} alt={`${project.title} cover`} className={styles.coverImg} />
          </div>
        </section>

        <section className={styles.body}>
          <div className={styles.left}>
            <h2 className={styles.h2}>Overview</h2>
<p className={styles.p}>
  {project.overview ?? "Overview coming soon."}
</p>

{project.problem || project.solution || project.results ? (
  <>
    <div className={styles.divider} />

    {project.problem ? (
      <>
        <h3 className={styles.h3}>Problem</h3>
        <p className={styles.p}>{project.problem}</p>
      </>
    ) : null}

    {project.solution ? (
      <>
        <div className={styles.divider} />
        <h3 className={styles.h3}>Solution</h3>
        <p className={styles.p}>{project.solution}</p>
      </>
    ) : null}

    {project.results ? (
      <>
        <div className={styles.divider} />
        <h3 className={styles.h3}>Results</h3>
        <p className={styles.p}>{project.results}</p>
      </>
    ) : null}
  </>
) : null}


            {/* Gallery */}
            {galleryItems.length ? (
              <>
                <div className={styles.divider} />
                <h2 className={styles.h2}>Gallery</h2>
                <ProjectGallery items={galleryItems} title={project.title} />
              </>
            ) : null}
          </div>

          <aside className={styles.right}>
            <div className={styles.panel}>
              <h3 className={styles.h3}>Quick details</h3>
              <ul className={styles.list}>
                {project.category ? <li className={styles.li}>Category: {project.category}</li> : null}
                {project.role ? <li className={styles.li}>Role: {project.role}</li> : null}
                {project.year ? <li className={styles.li}>Year: {project.year}</li> : null}
              </ul>
            </div>

            <div className={styles.panelAlt}>
              <div className={styles.panelAlt}>
  <h3 className={styles.h3}>Project notes</h3>
  <p className={styles.mutedSmall}>
    {project.project_notes ?? "Notes coming soon."}
  </p>
</div>

            </div>
          </aside>
        </section>

        <section className={styles.bottomNav}>
          <div className={styles.navGrid}>
            {prev ? (
              <Link href={`/work/${prev.slug}`} className={styles.navCard}>
                <span className={styles.navTop}>Previous</span>
                <span className={styles.navTitle}>{prev.title}</span>
                <span className={styles.navMeta}>{prev.category ?? ""}</span>
              </Link>
            ) : (
              <div className={styles.navCardDisabled}>
                <span className={styles.navTop}>Previous</span>
                <span className={styles.navTitle}>—</span>
                <span className={styles.navMeta}> </span>
              </div>
            )}

            {next ? (
              <Link href={`/work/${next.slug}`} className={styles.navCard}>
                <span className={styles.navTop}>Next</span>
                <span className={styles.navTitle}>{next.title}</span>
                <span className={styles.navMeta}>{next.category ?? ""}</span>
              </Link>
            ) : (
              <div className={styles.navCardDisabled}>
                <span className={styles.navTop}>Next</span>
                <span className={styles.navTitle}>—</span>
                <span className={styles.navMeta}> </span>
              </div>
            )}
          </div>
        </section>
      </div>
      {/* =======================
                            7. FOOTER
                        ======================== */}
                        <SiteFooter />
    </div>
  );
}
