// src/app/api/contact/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseService } from "@/lib/supabaseService";

type Payload = {
  name: string;
  email: string;
  projectType?: string;
  budget?: string;
  timeline?: string;
  message?: string;
  pageUrl?: string;
  referrer?: string;
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

function escapeHtml(input: string) {
  return (input ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(input: string) {
  return escapeHtml(input).replaceAll("\n", " ");
}

function infoRow(label: string, valueHtml: string) {
  return `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);">
      <div style="color:#aab0c0;font-size:12px;font-weight:700;">${escapeHtml(label)}</div>
      <div style="color:#ffffff;font-size:13px;font-weight:800;text-align:right;">${valueHtml}</div>
    </div>
  `;
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

    const projectType = safe(body.projectType);
    const budget = safe(body.budget);
    const timeline = safe(body.timeline);
    const message = safe(body.message);

    if (!name) {
      return NextResponse.json({ error: "Name is required.", code: "VALIDATION_NAME" }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return NextResponse.json({ error: "Valid email is required.", code: "VALIDATION_EMAIL" }, { status: 400 });
    }

    const referrer = body.referrer || req.headers.get("referer") || null;
    const pageUrl = body.pageUrl || null;

    // 1) Save to Supabase (primary outcome)
    const { error: dbError } = await (supabaseService as any)
      .from("contact_inquiries")
      .insert({
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
      });

    if (dbError) {
      console.error("SUPABASE ERROR:", dbError, requestInfo);
      return NextResponse.json(
        { error: "Failed to submit. Try again.", code: "SUPABASE_INSERT", dbError },
        { status: 500 }
      );
    }

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

    const html = `
      <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <div style="max-width:640px;margin:0 auto;padding:28px;">
          <div style="background:linear-gradient(135deg,#ff2ea6,#7c3aed,#22d3ee);padding:2px;border-radius:18px;">
            <div style="background:#0b0b0f;border-radius:16px;padding:22px 22px 18px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:14px;height:14px;border-radius:999px;background:#ff2ea6;box-shadow:0 0 0 4px rgba(255,46,166,.18);"></div>
                <div style="color:#fff;font-weight:900;letter-spacing:.2px;font-size:16px;">
                  Thrive Creative Studios
                </div>
              </div>
              <div style="margin-top:10px;color:#d7d7e0;font-size:13px;line-height:1.5;">
                New contact form inquiry received.
              </div>
            </div>
          </div>

          <div style="margin-top:16px;background:#11111a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;">
            <div style="color:#ffffff;font-size:18px;font-weight:900;margin-bottom:6px;">
              New inquiry: ${escapeHtml(name)}
            </div>

            <div style="color:#aab0c0;font-size:13px;margin-bottom:14px;">
              ${escapeHtml(projectType)} • ${escapeHtml(budget)} • ${escapeHtml(timeline)}
            </div>

            <div style="display:grid;grid-template-columns:1fr;gap:10px;">
              ${infoRow(
                "Email",
                `<a href="mailto:${escapeAttr(email)}" style="color:#22d3ee;text-decoration:none;font-weight:900;">${escapeHtml(
                  email
                )}</a>`
              )}
              ${infoRow("Project type", escapeHtml(projectType))}
              ${infoRow("Budget", escapeHtml(budget))}
              ${infoRow("Timeline", escapeHtml(timeline))}
            </div>

            <div style="margin-top:16px;padding:14px;border-radius:14px;background:#0b0b0f;border:1px solid rgba(255,255,255,.06);">
              <div style="color:#fff;font-weight:900;font-size:13px;margin-bottom:8px;">Details</div>
              <div style="color:#d7d7e0;font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
                message
              )}</div>
            </div>

            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
              <a href="mailto:${escapeAttr(email)}"
                 style="background:#ff2ea6;color:#0b0b0f;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;">
                Reply to client
              </a>
              ${
                pageUrl
                  ? `<a href="${escapeAttr(pageUrl)}"
                       style="background:rgba(255,255,255,.08);color:#fff;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:800;font-size:13px;">
                      View page
                    </a>`
                  : ""
              }
            </div>

            <div style="margin-top:14px;color:#7f879b;font-size:12px;line-height:1.5;">
              Page URL: <span style="color:#aab0c0;">${escapeHtml(pageUrl || "—")}</span><br/>
              Referrer: <span style="color:#aab0c0;">${escapeHtml(referrer || "—")}</span>
            </div>
          </div>

          <div style="margin-top:14px;color:#6c7386;font-size:12px;text-align:center;">
            Sent from Thrive Contact Form • ${new Date().toLocaleString("en-US")}
          </div>
        </div>
      </div>
    `;

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
