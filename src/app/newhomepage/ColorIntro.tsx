"use client";

// The fullscreen intro on the homepage: beige and grey pages slide in ("The world
// is filled with beige and grey."), then the brand colours slide over them ("We're
// bringing the color back, one company at a time."), then it all fades away to
// the hero. The fade is CSS, so the intro clears itself even if this script is
// late; the script only skips it on tap, unlocks scrolling and removes it.
import { useEffect, useRef, useState } from "react";
import s from "./ColorIntro.module.css";

const GREYS = ["#ece6da", "#d6d0c4", "#bdb8af", "#a39f98", "#cfc7b8"];
const COLORS = ["#fd6100", "#0cf574", "#3b43af", "#861dc5", "#e50586"];
// Match .intro's introOut delay and duration in ColorIntro.module.css.
const REVEAL_MS = 6300;
const FADE_MS = 700;

/** `onReveal` fires as the intro starts to fade, so the hero can play underneath it. */
export default function ColorIntro({ onReveal }: { onReveal: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const finish = () => {
      document.documentElement.style.overflow = "";
      setGone(true);
    };
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onReveal();
      finish();
      return;
    }
    // Timed from the intro's own CSS animation, not from when this script ran,
    // so a late script still reveals the hero when the fade starts (6.3s) and
    // clears it at 7s.
    const out = el.getAnimations().find((a) => (a as CSSAnimation).animationName?.includes("introOut"));
    const since = Number(out?.currentTime ?? 0);
    if (since < REVEAL_MS + FADE_MS) document.documentElement.style.overflow = "hidden";
    const revealTimer = setTimeout(onReveal, Math.max(0, REVEAL_MS - since));
    const doneTimer = setTimeout(finish, Math.max(0, REVEAL_MS + FADE_MS - since));
    // a tap fades it early (.skip); clear it when that fade ends
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && e.animationName.includes("introOut")) finish();
    };
    el.addEventListener("animationend", onEnd);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(doneTimer);
      el.removeEventListener("animationend", onEnd);
      document.documentElement.style.overflow = "";
    };
  }, [onReveal]);

  if (gone) return null;

  return (
    <div
      ref={ref}
      className={`${s.intro} ${skipping ? s.skip : ""}`}
      onClick={() => { setSkipping(true); onReveal(); }}
      aria-hidden
    >
      {GREYS.map((bg, i) => (
        <span key={bg} className={`${s.sheet} ${s.grey}`} style={{ "--i": i, background: bg } as React.CSSProperties} />
      ))}
      <p className={s.before}>
        <span>
          The world is filled with <span className={s.beige}>beige</span> and <span className={s.gray}>grey.</span>
        </span>
      </p>

      {COLORS.map((bg, i) => (
        <span key={bg} className={`${s.sheet} ${s.bright}`} style={{ "--i": i, background: bg } as React.CSSProperties} />
      ))}
      <p className={s.after}>
        <span className={s.line}>We&apos;re bringing the color back</span>
        <span className={s.oneAtATime}>one company at a time.</span>
      </p>

      <button type="button" className={s.skipBtn} tabIndex={-1}>Skip →</button>
    </div>
  );
}
