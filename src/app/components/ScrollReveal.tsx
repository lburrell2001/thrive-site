"use client";

// Fades in every [data-reveal] element on the page as it scrolls into view
// (styles in globals.css). Content is only hidden once this has run, so the
// page reads fine without JavaScript. An element can stagger itself with
// style={{ "--reveal-delay": "120ms" }}.

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("reveal-ready");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.setAttribute("data-shown", ""); obs.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => obs.observe(el));
    watch();
    // Tiles added later (e.g. after a filter change) get picked up too.
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); mo.disconnect(); document.documentElement.classList.remove("reveal-ready"); };
  }, []);
  return null;
}
