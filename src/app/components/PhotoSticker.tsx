// A round die-cut photo sticker: white edge, the work inside, the service's full
// name running round a colour ring. Size it with --s on a parent (or its width).
import type { ServiceTone } from "@/lib/serviceShowcase";
import s from "./PhotoSticker.module.css";

const RING_R = 41.5;
const RING_LEN = 2 * Math.PI * RING_R;

export default function PhotoSticker({ name, img, tone, id }: { name: string; img: string; tone: ServiceTone; id: string }) {
  // the name twice with stars between, sized so any name fills the ring
  const text = `${name.toUpperCase()} ✦ `.repeat(2);
  const size = Math.min(9.5, RING_LEN / (text.length * 0.8));
  return (
    <span className={`${s.art} ${s[tone]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" className={s.img} />
      <svg viewBox="0 0 100 100" className={s.ring} aria-hidden>
        <defs>
          <path id={id} d={`M${50 - RING_R},50 a${RING_R},${RING_R} 0 1,1 ${RING_R * 2},0 a${RING_R},${RING_R} 0 1,1 ${-RING_R * 2},0`} />
        </defs>
        <circle cx={50} cy={50} r={RING_R} className={s.band} />
        <circle cx={50} cy={50} r={RING_R - 8.5} className={s.edge} />
        <text className={s.text} fontSize={size} dominantBaseline="central">
          <textPath href={`#${id}`} textLength={RING_LEN - 2} lengthAdjust="spacing">{text}</textPath>
        </text>
      </svg>
    </span>
  );
}
