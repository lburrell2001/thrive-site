"use client";

// Lauren's hometown story, shortened by default: where she grew up and why she
// works with Amarillo businesses. "Read the whole story" shows every paragraph
// in order. All of it is in the HTML either way, so search engines see it.
import { useState } from "react";
import s from "./amarillo.module.css";

/** Paragraph indexes shown while the story is collapsed. */
const SHORT = [0, 2];

export default function HometownStory({ paragraphs, signoff }: { paragraphs: string[]; signoff: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.prose}>
      <div id="hometown-story">
        {paragraphs.map((text, i) => (
          <p key={text.slice(0, 40)} hidden={!open && !SHORT.includes(i)}>{text}</p>
        ))}
      </div>
      <p className={s.signoff}>{signoff}</p>
      <button type="button" className={s.storyToggle} aria-expanded={open} aria-controls="hometown-story" onClick={() => setOpen(!open)}>
        {open ? "Show less" : "Read the whole story"}
      </button>
    </div>
  );
}
