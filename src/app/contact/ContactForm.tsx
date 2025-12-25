"use client";

import { useState } from "react";

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setErr(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      projectType: String(formData.get("projectType") || ""),
      budget: String(formData.get("budget") || ""),
      timeline: String(formData.get("timeline") || ""),
      message: String(formData.get("message") || ""),
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) setErr(data?.error || "Something went wrong. Please try again.");
      else {
        setOk("Got it! I’ll reply with next steps within 1–2 business days.");
        form.reset();
      }
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ marginTop: 32, maxWidth: 560, display: "grid", gap: 16, fontSize: 14 }}
    >
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" placeholder="Your name" style={inputStyle} required />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          style={inputStyle}
          required
        />
      </div>

      <div>
        <label htmlFor="projectType">What are you looking for?</label>
        <select id="projectType" name="projectType" style={inputStyle} defaultValue="">
          <option value="">Select one</option>
          <option>Branding / logo</option>
          <option>Poster or print design</option>
          <option>Website / UI design</option>
          <option>Motion graphics / video</option>
          <option>Social media graphics</option>
          <option>Something else</option>
        </select>
      </div>

      <div>
        <label htmlFor="budget">Estimated budget</label>
        <select id="budget" name="budget" style={inputStyle} defaultValue="">
          <option value="">Choose a range</option>
          <option>Under $200</option>
          <option>$200 – $400</option>
          <option>$400 – $750</option>
          <option>$750+</option>
        </select>
      </div>

      <div>
        <label htmlFor="timeline">Timeline</label>
        <input
          id="timeline"
          name="timeline"
          type="text"
          placeholder="For example: launch in March, or flexible"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="message">Project details</label>
        <textarea
          id="message"
          name="message"
          placeholder="Tell me about your brand, goals, and any links you'd like to share."
          rows={5}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
        All confirmed bookings require a $30 deposit to secure your spot. After you submit this form,
        I&apos;ll follow up with a quick discovery call and next steps.
      </p>

      {err && <p style={{ fontSize: 13, marginTop: 6, color: "#b00020" }}><strong>{err}</strong></p>}
      {ok && <p style={{ fontSize: 13, marginTop: 6 }}><strong>{ok}</strong></p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{ marginTop: 8, width: "fit-content", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Submitting…" : "Submit inquiry"}
      </button>

      <p style={{ fontSize: 12, color: "#555", marginTop: 12 }}>
        Prefer email? Reach me at{" "}
        <a href="mailto:thrivecreativestudios@gmail.com" style={{ textDecoration: "underline" }}>
         thrivecreativestudios@gmail.com
        </a>
        .
      </p>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 14,
  outline: "none",
};
