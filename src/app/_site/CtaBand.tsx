// The magenta "Let's Make Something Bold." band that closes every redesign page.

import Link from 'next/link';
import { rd } from './links';
import s from './redesign.module.css';

export default function CtaBand({ heading = <>Let’s Make<br />Something Bold.</>, text = 'Tell us about your business. You’ll get a written proposal before any work begins.' }: { heading?: React.ReactNode; text?: string }) {
  return (
    <section className={s.cta}>
      <h2 className={`${s.display} ${s.ctaHead} ${s.rise}`}>{heading}</h2>
      <p className={s.leadText}>{text}</p>
      <div className={s.ctaRow}>
        <Link href={rd('/contact')} className={`${s.pill} ${s.pillBig}`}>Let’s Start a Project</Link>
        <Link href="/book" className={`${s.pill} ${s.pillBig} ${s.pillOutline}`}>Book a call</Link>
      </div>
    </section>
  );
}
