"use client";

import { useMemo, useState } from "react";

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const styles = useMemo(() => {
    const label: React.CSSProperties = {
      display: "block",
      fontWeight: 650,
      fontSize: 13,
      color: "#111",
      marginBottom: 6,
    };

    const controlBase: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,

      backgroundColor: "#ffffff",
      color: "#111111",
      border: "1px solid rgba(0,0,0,0.15)",

      fontSize: 14,
      lineHeight: 1.4,
      outline: "none",

      transition: "border-color 150ms ease, box-shadow 150ms ease",
    };

    const helper: React.CSSProperties = {
      fontSize: 12,
      color: "rgba(0,0,0,0.65)",
      marginTop: 10,
      lineHeight: 1.5,
    };

    const alertBase: React.CSSProperties = {
      fontSize: 13,
      marginTop: 6,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.08)",
    };

    return { label, controlBase, helper, alertBase };
  }, []);

  function focusStyle(on: boolean): React.CSSProperties {
    return on
      ? {
          borderColor: "var(--thrive-magenta)",
          boxShadow: "0 0 0 3px rgba(209, 46, 131, 0.18)",
        }
      : {};
  }

  // Track focus per-field so we can emulate :focus with inline styles
  const [focus, setFocus] = useState<Record<string, boolean>>({
    name: false,
    email: false,
    projectType: false,
    budget: false,
    timeline: false,
    message: false,
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setErr(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      projectType: String(formData.get("projectType") || "").trim(),
      budget: String(formData.get("budget") || "").trim(),
      timeline: String(formData.get("timeline") || "").trim(),
      message: String(formData.get("message") || "").trim(),
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

      if (!res.ok) {
        setErr(data?.error || "Something went wrong. Please try again.");
      } else {
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
      style={{
        marginTop: 28,
        maxWidth: 560,
        display: "grid",
        gap: 16,
        fontSize: 14,
      }}
    >
      {/* NAME */}
      <div>
        <label htmlFor="name" style={styles.label}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          required
          style={{ ...styles.controlBase, ...focusStyle(focus.name) }}
          onFocus={() => setFocus((s) => ({ ...s, name: true }))}
          onBlur={() => setFocus((s) => ({ ...s, name: false }))}
        />
      </div>

      {/* EMAIL */}
      <div>
        <label htmlFor="email" style={styles.label}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          style={{ ...styles.controlBase, ...focusStyle(focus.email) }}
          onFocus={() => setFocus((s) => ({ ...s, email: true }))}
          onBlur={() => setFocus((s) => ({ ...s, email: false }))}
        />
      </div>

      {/* PROJECT TYPE */}
      <div>
        <label htmlFor="projectType" style={styles.label}>
          What are you looking for?
        </label>
        <select
          id="projectType"
          name="projectType"
          defaultValue=""
          style={{
            ...styles.controlBase,
            ...focusStyle(focus.projectType),
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, rgba(0,0,0,0.55) 50%), linear-gradient(135deg, rgba(0,0,0,0.55) 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 18px) 50%, calc(100% - 12px) 50%",
            backgroundSize: "6px 6px, 6px 6px",
            backgroundRepeat: "no-repeat",
            paddingRight: 34,
          }}
          onFocus={() => setFocus((s) => ({ ...s, projectType: true }))}
          onBlur={() => setFocus((s) => ({ ...s, projectType: false }))}
        >
          <option value="">Select one</option>
          <option>Branding / logo</option>
          <option>Poster or print design</option>
          <option>Website / UI design</option>
          <option>Motion graphics / video</option>
          <option>Social media graphics</option>
          <option>Something else</option>
        </select>
      </div>

      {/* BUDGET */}
      <div>
        <label htmlFor="budget" style={styles.label}>
          Estimated budget
        </label>
        <select
          id="budget"
          name="budget"
          defaultValue=""
          style={{
            ...styles.controlBase,
            ...focusStyle(focus.budget),
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, rgba(0,0,0,0.55) 50%), linear-gradient(135deg, rgba(0,0,0,0.55) 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 18px) 50%, calc(100% - 12px) 50%",
            backgroundSize: "6px 6px, 6px 6px",
            backgroundRepeat: "no-repeat",
            paddingRight: 34,
          }}
          onFocus={() => setFocus((s) => ({ ...s, budget: true }))}
          onBlur={() => setFocus((s) => ({ ...s, budget: false }))}
        >
          <option value="">Choose a range</option>
          <option>Under $200</option>
          <option>$200 – $400</option>
          <option>$400 – $750</option>
          <option>$750+</option>
        </select>
      </div>

      {/* TIMELINE */}
      <div>
        <label htmlFor="timeline" style={styles.label}>
          Timeline
        </label>
        <input
          id="timeline"
          name="timeline"
          type="text"
          placeholder="For example: launch in March, or flexible"
          style={{ ...styles.controlBase, ...focusStyle(focus.timeline) }}
          onFocus={() => setFocus((s) => ({ ...s, timeline: true }))}
          onBlur={() => setFocus((s) => ({ ...s, timeline: false }))}
        />
      </div>

      {/* MESSAGE */}
      <div>
        <label htmlFor="message" style={styles.label}>
          Project details
        </label>
        <textarea
          id="message"
          name="message"
          placeholder="Tell me about your brand, goals, and any links you'd like to share."
          rows={6}
          style={{
            ...styles.controlBase,
            ...focusStyle(focus.message),
            resize: "vertical",
          }}
          onFocus={() => setFocus((s) => ({ ...s, message: true }))}
          onBlur={() => setFocus((s) => ({ ...s, message: false }))}
        />
      </div>

      {/* HELPER TEXT */}
      <p style={styles.helper}>
        All confirmed bookings require a <strong>$30 deposit</strong> to secure your spot. After you
        submit this form, I&apos;ll follow up with a quick discovery call and next steps.
      </p>

      {/* STATUS */}
      {err && (
        <p
          style={{
            ...styles.alertBase,
            color: "#7a0b1a",
            background: "rgba(176, 0, 32, 0.06)",
            borderColor: "rgba(176, 0, 32, 0.18)",
          }}
        >
          <strong>{err}</strong>
        </p>
      )}
      {ok && (
        <p
          style={{
            ...styles.alertBase,
            color: "#0b5a2a",
            background: "rgba(16, 185, 129, 0.10)",
            borderColor: "rgba(16, 185, 129, 0.20)",
          }}
        >
          <strong>{ok}</strong>
        </p>
      )}

      {/* SUBMIT */}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{
          marginTop: 6,
          width: "fit-content",
          opacity: loading ? 0.75 : 1,
        }}
      >
        {loading ? "Submitting…" : "Submit inquiry"}
      </button>

      {/* EMAIL FALLBACK */}
      <p style={{ ...styles.helper, marginTop: 10 }}>
        Prefer email? Reach me at{" "}
        <a href="mailto:hello@thrivecreativestudios.org" style={{ textDecoration: "underline" }}>
          hello@thrivecreativestudios.org
        </a>
        .
      </p>
    </form>
  );
}
