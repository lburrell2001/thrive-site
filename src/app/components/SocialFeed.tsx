import s from "./SocialFeed.module.css";

// Real posts Thrive designed, shown on the social media service page.
const POSTS = [
  { src: "/services/social/web/rootstowellnessnow-feed-01.jpg", client: "Roots to Wellness Now", kind: "Feed post", w: 1080, h: 1350 },
  { src: "/services/social/web/thrive-story-01.jpg", client: "Thrive Creative Studios", kind: "Story", w: 1080, h: 1920 },
  { src: "/services/social/web/rootstowellnessnow-post-01.jpg", client: "Roots to Wellness Now", kind: "Post", w: 1080, h: 1350 },
  { src: "/services/social/web/thrive-feed-01.jpg", client: "Thrive Creative Studios", kind: "Feed post", w: 1080, h: 1350 },
  { src: "/services/social/web/thrive-post-01.jpg", client: "Thrive Creative Studios", kind: "Post", w: 1080, h: 1080 },
];

export default function SocialFeed({ accent }: { accent: string }) {
  return (
    <section className={s.feed} aria-labelledby="feed-heading">
      <p className={s.eyebrow}>Straight from the feed</p>
      <h2 id="feed-heading" className={s.h2}>Posts we&apos;ve designed</h2>
      <div className={s.grid}>
        {POSTS.map((p, i) => (
          <figure key={p.src} className={s.post} style={{ ["--tilt" as string]: `${[-2, 1.5, -1, 2, -1.5][i]}deg` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} width={p.w} height={p.h} loading="lazy" alt={`${p.kind} designed for ${p.client}`} />
            <figcaption>
              <span style={{ color: accent }}>{p.kind}</span> · {p.client}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
