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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const projectType = (body.projectType || "").trim() || "—";
    const budget = (body.budget || "").trim() || "—";
    const timeline = (body.timeline || "").trim() || "—";
    const message = (body.message || "").trim() || "—";

    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email || !isEmail(email))
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });

    // 1) Save to Supabase
    const { error } = await supabaseService.from("contact_inquiries").insert({
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

    if (error) {
      return NextResponse.json({ error: "Failed to submit. Try again." }, { status: 500 });
    }

    // 2) Email notification (Resend)
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

    // Don’t block the user if email fails — but do attempt it
   const { data, error: emailError } = await resend.emails.send({
  from,
  to,
  subject,
  text,
  replyTo: email,
});

if (emailError) {
  console.error("RESEND ERROR:", emailError);
  return NextResponse.json({ ok: true, emailed: false, emailError }, { status: 200 });
}

return NextResponse.json({ ok: true, emailed: true, data });

  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
