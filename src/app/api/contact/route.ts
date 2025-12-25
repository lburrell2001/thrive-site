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

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function safe(input?: string | null) {
  const s = (input ?? "").toString().trim();
  return s.length ? s : "—";
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
  try {
    const body = (await req.json()) as Payload;

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();

    const projectType = safe(body.projectType);
    const budget = safe(body.budget);
    const timeline = safe(body.timeline);
    const message = safe(body.message);

    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email || !isEmail(email))
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });

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
    referrer: body.referrer || req.headers.get("referer"),
    page_url: body.pageUrl || null,
    status: "new",
  });



    if (dbError) {
      return NextResponse.json({ error: "Failed to submit. Try again." }, { status: 500 });
    }

    // 2) Email notification (secondary outcome)
    const resend = new Resend(env("RESEND_API_KEY"));
    const to = env("CONTACT_NOTIFY_TO");
    const from = env("CONTACT_NOTIFY_FROM");

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
      `Page URL: ${body.pageUrl || "—"}`,
      `Referrer: ${body.referrer || "—"}`,
    ].join("\n");

    const html = `
      <div style="margin:0;padding:0;background:#0b0b0f;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <div style="max-width:640px;margin:0 auto;padding:28px;">

          <!-- Header -->
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

          <!-- Body -->
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
                body.pageUrl
                  ? `<a href="${escapeAttr(body.pageUrl)}"
                       style="background:rgba(255,255,255,.08);color:#fff;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:800;font-size:13px;">
                      View page
                    </a>`
                  : ""
              }
            </div>

            <div style="margin-top:14px;color:#7f879b;font-size:12px;line-height:1.5;">
              Page URL: <span style="color:#aab0c0;">${escapeHtml(body.pageUrl || "—")}</span><br/>
              Referrer: <span style="color:#aab0c0;">${escapeHtml(body.referrer || "—")}</span>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top:14px;color:#6c7386;font-size:12px;text-align:center;">
            Sent from Thrive Contact Form • ${new Date().toLocaleString("en-US")}
          </div>

        </div>
      </div>
    `;

    const { data, error: emailError } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text, // fallback
      replyTo: email, // hitting “reply” goes to the client
    });

    if (emailError) {
      console.error("RESEND ERROR:", emailError);
      return NextResponse.json({ ok: true, emailed: false, emailError }, { status: 200 });
    }

    return NextResponse.json({ ok: true, emailed: true, data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
