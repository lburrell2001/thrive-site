"use client";

import { useState } from "react";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import PublicLayout from "../components/PublicLayout";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
  display: "swap",
});

const baiJamjuree = Bai_Jamjuree({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-bai",
  display: "swap",
});

const INFO_ROWS = [
  { label: "Email", value: "hello@thrivecreativestudios.org" },
  { label: "Location", value: "Dallas, TX" },
  { label: "Instagram", value: "@thrivecreativestudios" },
  { label: "Response Time", value: "Within 24–48 hours" },
];

const FAQ_ITEMS = [
  {
    q: "How long does a project take?",
    a: "Brand identities 4–6 weeks. Web design 6–8 weeks. Social retainers are monthly.",
  },
  {
    q: "Do you work with startups?",
    a: "Yes! We love working with brands at every stage — from day one to established businesses leveling up.",
  },
  {
    q: "How do I get started?",
    a: "Fill out the form or email us directly. We'll schedule a discovery call to see if we're a great fit.",
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    service: "",
    description: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // silently fail — user can try again
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable}`}>
        <style>{`
          .ct-page {
            background: #fff;
            color: #0a0a0a;
          }

          /* ── HERO ── */
          .ct-hero {
            position: relative;
            padding: 80px 80px 64px;
            box-sizing: border-box;
            overflow: hidden;
          }
          .ct-ghost {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(80px, 11vw, 160px);
            color: rgba(0,0,0,.05);
            position: absolute;
            top: 10px;
            left: 0;
            z-index: 0;
            pointer-events: none;
            line-height: 1;
            white-space: nowrap;
            user-select: none;
          }
          .ct-eyebrow {
            position: relative;
            z-index: 1;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #808080;
            margin-bottom: 16px;
            display: block;
          }
          .ct-h1 {
            position: relative;
            z-index: 1;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(48px, 7vw, 88px);
            letter-spacing: -0.04em;
            line-height: 1;
            margin: 0 0 20px;
          }
          .ct-subtitle {
            position: relative;
            z-index: 1;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 16px;
            line-height: 1.7;
            color: #444;
            max-width: 560px;
            margin: 0;
          }

          /* ── BODY ── */
          .ct-body {
            padding: 0 80px 80px;
            display: grid;
            grid-template-columns: 3fr 2fr;
            gap: 32px;
            box-sizing: border-box;
          }

          /* ── FORM CARD ── */
          .ct-form-card {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
          }
          .ct-form-bar {
            height: 4px;
            background: #e50586;
          }
          .ct-form-inner {
            padding: 36px;
          }
          .ct-form-label-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            letter-spacing: -0.01em;
            margin-bottom: 24px;
            display: block;
          }
          .ct-field {
            margin-bottom: 20px;
          }
          .ct-field label {
            display: block;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #0a0a0a;
          }
          .ct-field input,
          .ct-field select,
          .ct-field textarea {
            width: 100%;
            border: 2px solid #0a0a0a;
            border-radius: 6px;
            padding: 12px 16px;
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
            transition: border-color .15s;
            background: #fff;
            color: #0a0a0a;
            appearance: auto;
          }
          .ct-field input:focus,
          .ct-field select:focus,
          .ct-field textarea:focus {
            border-color: #e50586;
          }
          .ct-field textarea {
            min-height: 120px;
            resize: vertical;
          }
          .ct-submit-btn {
            width: 100%;
            background: #e50586;
            color: #fff;
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 16px;
            padding: 16px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            letter-spacing: -0.01em;
            transition: opacity .15s, transform .12s;
          }
          .ct-submit-btn:hover { opacity: 0.88; transform: scale(1.01); }
          .ct-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
          .ct-success {
            text-align: center;
            padding: 48px 24px;
          }
          .ct-success-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 28px;
            letter-spacing: -0.02em;
            margin: 0 0 12px;
            color: #e50586;
          }
          .ct-success-text {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 15px;
            color: #444;
            line-height: 1.7;
            margin: 0;
          }

          /* ── INFO CARD ── */
          .ct-info-card {
            background: #f5f4f2;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
          }
          .ct-info-bar {
            height: 4px;
            background: #0cf574;
          }
          .ct-info-inner {
            padding: 36px;
          }
          .ct-info-label-heading {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 14px;
            letter-spacing: -0.01em;
            margin-bottom: 24px;
            display: block;
          }
          .ct-info-row {
            border-bottom: 1px solid #e5e5e5;
            padding: 16px 0;
          }
          .ct-info-row:last-child { border-bottom: none; }
          .ct-info-row-label {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #808080;
            margin-bottom: 4px;
            display: block;
          }
          .ct-info-row-value {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 15px;
            color: #0a0a0a;
            margin: 0;
          }

          /* ── FAQ ── */
          .ct-faq {
            background: #0a0a0a;
            padding: 80px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
          }
          .ct-faq-ghost {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(60px, 10vw, 140px);
            color: rgba(255,255,255,.04);
            position: absolute;
            top: 20px;
            left: 0;
            pointer-events: none;
            line-height: 1;
            white-space: nowrap;
            user-select: none;
          }
          .ct-faq-h2 {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: clamp(32px, 5vw, 52px);
            color: #fff;
            letter-spacing: -0.03em;
            margin: 0 0 56px;
            position: relative;
            z-index: 1;
          }
          .ct-faq-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
            position: relative;
            z-index: 1;
          }
          .ct-faq-q {
            font-family: var(--font-bungee, 'Bungee', sans-serif);
            font-size: 16px;
            color: #fff;
            letter-spacing: -0.01em;
            margin-bottom: 12px;
          }
          .ct-faq-a {
            font-family: var(--font-bai, 'Bai Jamjuree', sans-serif);
            font-size: 14px;
            color: rgba(255,255,255,.6);
            line-height: 1.7;
            margin: 0;
          }

          /* ── TABLET ── */
          @media (max-width: 960px) {
            .ct-hero { padding: 60px 48px 40px; }
            .ct-body { padding: 0 48px 60px; }
            .ct-faq { padding: 60px 48px; }
            .ct-faq-grid { grid-template-columns: repeat(2, 1fr); }
          }

          /* ── MOBILE ── */
          @media (max-width: 767px) {
            .ct-hero { padding: 60px 24px 40px; }
            .ct-ghost { display: none; }
            .ct-body {
              grid-template-columns: 1fr;
              padding: 0 24px 60px;
            }
            .ct-faq { padding: 60px 24px; }
            .ct-faq-ghost { display: none; }
            .ct-faq-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="ct-page">

          {/* ── HERO ── */}
          <section className="ct-hero">
            <span className="ct-ghost">LET&apos;S TALK</span>
            <span className="ct-eyebrow">GET IN TOUCH</span>
            <h1 className="ct-h1">READY TO THRIVE?</h1>
            <p className="ct-subtitle">
              Whether you&apos;re building from scratch or leveling up — let&apos;s make something
              unforgettable together.
            </p>
          </section>

          {/* ── BODY ── */}
          <div className="ct-body">

            {/* Form card */}
            <div className="ct-form-card">
              <div className="ct-form-bar" />
              <div className="ct-form-inner">
                <span className="ct-form-label-heading">START A PROJECT</span>

                {submitted ? (
                  <div className="ct-success">
                    <p className="ct-success-heading">You&apos;re in! 🎉</p>
                    <p className="ct-success-text">
                      Thanks for reaching out. We&apos;ll be in touch within 24–48 hours
                      to schedule a discovery call.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="ct-field">
                      <label htmlFor="ct-name">Name</label>
                      <input
                        id="ct-name"
                        name="name"
                        type="text"
                        placeholder="Your full name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="ct-field">
                      <label htmlFor="ct-company">Company</label>
                      <input
                        id="ct-company"
                        name="company"
                        type="text"
                        placeholder="Your company or brand name"
                        value={formData.company}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="ct-field">
                      <label htmlFor="ct-email">Email</label>
                      <input
                        id="ct-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        required
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="ct-field">
                      <label htmlFor="ct-service">Service</label>
                      <select
                        id="ct-service"
                        name="service"
                        required
                        value={formData.service}
                        onChange={handleChange}
                      >
                        <option value="">Select a service...</option>
                        <option value="Brand Design">Brand Design</option>
                        <option value="Digital Design">Digital Design</option>
                        <option value="Social Media">Social Media</option>
                        <option value="UX Design">UX Design</option>
                        <option value="Photography">Photography</option>
                      </select>
                    </div>
                    <div className="ct-field">
                      <label htmlFor="ct-description">Tell us about your project</label>
                      <textarea
                        id="ct-description"
                        name="description"
                        placeholder="Share a bit about what you need and your timeline..."
                        required
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </div>
                    <button
                      type="submit"
                      className="ct-submit-btn"
                      disabled={submitting}
                    >
                      {submitting ? "SENDING..." : "LET'S GET STARTED →"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="ct-info-card">
              <div className="ct-info-bar" />
              <div className="ct-info-inner">
                <span className="ct-info-label-heading">GET IN TOUCH</span>
                {INFO_ROWS.map((row, i) => (
                  <div key={i} className="ct-info-row">
                    <span className="ct-info-row-label">{row.label}</span>
                    <p className="ct-info-row-value">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── FAQ ── */}
          <section className="ct-faq">
            <span className="ct-faq-ghost">FREQUENTLY ASKED</span>
            <h2 className="ct-faq-h2">FREQUENTLY ASKED</h2>
            <div className="ct-faq-grid">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i}>
                  <p className="ct-faq-q">{item.q}</p>
                  <p className="ct-faq-a">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
