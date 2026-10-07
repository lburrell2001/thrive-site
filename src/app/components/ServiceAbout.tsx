// The longer read under a service page's hero: what the service is, how it
// runs, what's included and who it's for. Copy lives in serviceSeo.ts so it
// stays next to the FAQs it must agree with.

import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import s from './ServiceAbout.module.css';

export default function ServiceAbout({ slug, accent }: { slug: ServiceSlug; accent: string }) {
  const about = SERVICE_SEO[slug].about;
  if (!about) return null;
  return (
    <section className={s.about} aria-labelledby={`about-${slug}`}>
      <p className="sp-section-eyebrow">The details</p>
      <h2 id={`about-${slug}`} className="sp-section-heading">{about.heading}</h2>
      <div className={s.grid}>
        <div className={s.copy}>
          {about.paragraphs.map((text) => <p key={text.slice(0, 40)}>{text}</p>)}
        </div>
        <aside className={s.who} style={{ borderColor: accent }}>
          <h3 className={s.whoTitle}>Who it’s for</h3>
          <ul className={s.whoList}>
            {about.forWho.map((item) => (
              <li key={item}><span className={s.dot} style={{ background: accent }} aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
