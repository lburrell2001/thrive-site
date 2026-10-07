import s from "./FounderNote.module.css";

// Lauren's portrait with a line about who the visitor will hear from.
// Used where a form would otherwise be the only thing on the page.
export default function FounderNote({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <div className={`${s.note} ${tone === "dark" ? s.dark : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lauren-portrait.jpg" alt="Lauren Burrell, founder of Thrive Creative Studios" width={72} height={72} loading="lazy" />
      <div>
        <p className={s.name}>Lauren Burrell</p>
        <p className={s.text}>{children}</p>
      </div>
    </div>
  );
}
