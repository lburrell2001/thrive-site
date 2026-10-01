// src/app/api/contact/route.ts
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import { textAgency } from "@/lib/sms";
import { BRAND, brandEmail, button as emailButton, links, panel, paragraph, rows } from "@/lib/emailLayout";
import { attributionFor, type AttributionInput } from "@/lib/inquiryAttribution";

// The generated Database type only knows the original contact_inquiries
// columns; the attribution columns and site_pageviews came later.
const db = supabaseService as unknown as SupabaseClient;

type Payload = {
  name: string;
  email: string;
  company?: string;
  projectType?: string;
  /** Older field names some forms send; accepted so nothing is dropped. */
  service?: string;
  description?: string;
  budget?: string;
  timeline?: string;
  message?: string;
  pageUrl?: string;
  referrer?: string;
  attribution?: AttributionInput;
};

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function safe(input?: string | null) {
  const s = (input ?? "").toString().trim();
  return s.length ? s : "—";
}

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}


/** Accept JSON / FormData / raw text gracefully */
async function readPayload(req: Request): Promise<Payload> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    return (await req.json()) as Payload;
  }

  // FormData
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    return {
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      projectType: String(fd.get("projectType") || fd.get("project_type") || ""),
      budget: String(fd.get("budget") || ""),
      timeline: String(fd.get("timeline") || ""),
      message: String(fd.get("message") || ""),
      pageUrl: String(fd.get("pageUrl") || ""),
      referrer: String(fd.get("referrer") || ""),
    };
  }

  // Raw text fallback (handles missing/odd content-type)
  const raw = await req.text();
  if (!raw) return {} as Payload;

  try {
    return JSON.parse(raw) as Payload;
  } catch {
    // If someone posted plain text, don’t explode
    return { message: raw } as Payload;
  }
}

export async function POST(req: Request) {
  // Helpful request context (for debugging)
  const requestInfo = {
    contentType: req.headers.get("content-type") || "",
    origin: req.headers.get("origin") || "",
    referer: req.headers.get("referer") || "",
  };

  try {
    const body = await readPayload(req);

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();

    const projectType = safe(body.projectType || body.service);
    const company = (body.company || "").toString().trim().slice(0, 160) || null;
    const budget = safe(body.budget);
    const timeline = safe(body.timeline);
    const message = safe(body.message || body.description);

    if (!name) {
      return NextResponse.json({ error: "Name is required.", code: "VALIDATION_NAME" }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return NextResponse.json({ error: "Valid email is required.", code: "VALIDATION_EMAIL" }, { status: 400 });
    }

    const referrer = body.referrer || req.headers.get("referer") || null;
    const pageUrl = body.pageUrl || null;

    // 1) Save to Supabase (primary outcome)
    const attribution = await attributionFor(db, body.attribution, req.headers.get("host"));
    const row = {
      name,
      email,
      project_type: projectType === "—" ? null : projectType,
      budget: budget === "—" ? null : budget,
      timeline: timeline === "—" ? null : timeline,
      message: message === "—" ? null : message,
      user_agent: req.headers.get("user-agent"),
      referrer,
      page_url: pageUrl,
      status: "new",
    };
    // Columns added by later migrations (020 attribution, 024 company).
    const extras = { ...(attribution ?? {}), ...(company ? { company } : {}) };
    let { error: dbError } = await db
      .from("contact_inquiries")
      .insert({ ...row, ...extras });
    // The inquiry matters more than the extras: if a newer column is missing
    // (its migration not applied yet), save the inquiry without them.
    if (dbError && Object.keys(extras).length) {
      console.error("Inquiry insert with extras failed, retrying without:", dbError.message);
      ({ error: dbError } = await db.from("contact_inquiries").insert(row));
    }

    if (dbError) {
      console.error("SUPABASE ERROR:", dbError, requestInfo);
      return NextResponse.json(
        { error: "Failed to submit. Try again.", code: "SUPABASE_INSERT", dbError },
        { status: 500 }
      );
    }

    // "Instagram", or "Google (first found via Instagram)" when they differ.
    const foundVia = attribution?.source
      ? attribution.first_source && attribution.first_source !== attribution.source
        ? `${attribution.source} (first found via ${attribution.first_source})`
        : attribution.source
      : attribution?.first_source ?? null;

    // Text Lauren too, if CONTACT_NOTIFY_PHONE is set. After the response.
    after(() =>
      textAgency(
        `New Thrive inquiry from ${name}${projectType && projectType !== "—" ? ` (${projectType})` : ""} — ${email}`
      )
    );

    // 2) Email notification (secondary outcome) — NEVER block submission
    const RESEND_API_KEY = getEnv("RESEND_API_KEY");
    const CONTACT_NOTIFY_TO = getEnv("CONTACT_NOTIFY_TO");
    const CONTACT_NOTIFY_FROM = getEnv("CONTACT_NOTIFY_FROM");

    // If env isn’t set on Vercel, still return success for the form
    if (!RESEND_API_KEY || !CONTACT_NOTIFY_TO || !CONTACT_NOTIFY_FROM) {
      console.warn("EMAIL SKIPPED: Missing env vars", {
        hasResendKey: !!RESEND_API_KEY,
        hasTo: !!CONTACT_NOTIFY_TO,
        hasFrom: !!CONTACT_NOTIFY_FROM,
        requestInfo,
      });

      return NextResponse.json(
        { ok: true, emailed: false, code: "EMAIL_SKIPPED_MISSING_ENV" },
        { status: 200 }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    const subject = `New Thrive inquiry — ${name} (${projectType})`;

    const text = [
      `New inquiry received:`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      `Project type: ${projectType}`,
      `Budget: ${budget}`,
      `Timeline: ${timeline}`,
      ``,
      `Details:`,
      `${message}`,
      ``,
      `Page URL: ${pageUrl || "—"}`,
      `Referrer: ${referrer || "—"}`,
    ].join("\n");

    const html = brandEmail({
      title: subject,
      preheader: `${projectType} · ${budget} · ${timeline}`,
      eyebrow: "New inquiry",
      heading: name,
      body: [
        rows([
          { label: "Email", value: email, href: `mailto:${email}` },
          ...(company ? [{ label: "Company", value: company }] : []),
          { label: "Project type", value: projectType },
          { label: "Budget", value: budget },
          { label: "Timeline", value: timeline },
          ...(foundVia ? [{ label: "Found us via", value: foundVia }] : []),
        ]),
        panel(message),
        emailButton(`mailto:${email}`, `Reply to ${name.split(" ")[0] || name}`),
        pageUrl ? links([{ href: pageUrl, label: "View the page they sent it from" }]) : "",
        paragraph(`Page: ${pageUrl || "—"}\nReferrer: ${referrer || "—"}`, { size: 12, color: BRAND.muted }),
      ].join("\n"),
    });

    try {
      const { data, error: emailError } = await resend.emails.send({
        from: CONTACT_NOTIFY_FROM,
        to: CONTACT_NOTIFY_TO,
        subject,
        html,
        text,
        replyTo: email,
      });

      if (emailError) {
        console.error("RESEND ERROR:", emailError, requestInfo);
        return NextResponse.json({ ok: true, emailed: false, code: "EMAIL_FAILED", emailError }, { status: 200 });
      }

      return NextResponse.json({ ok: true, emailed: true, code: "OK", data }, { status: 200 });
    } catch (emailCrash) {
      console.error("EMAIL CRASH:", emailCrash, requestInfo);
      return NextResponse.json(
        { ok: true, emailed: false, code: "EMAIL_CRASH", details: emailCrash instanceof Error ? emailCrash.message : String(emailCrash) },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("CONTACT API ERROR:", err, requestInfo);
    return NextResponse.json(
      {
        error: "Invalid request.",
        code: "REQUEST_PARSE_OR_RUNTIME",
        details: err instanceof Error ? err.message : String(err),
        requestInfo,
      },
      { status: 400 }
    );
  }
}
