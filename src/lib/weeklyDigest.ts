// The Monday digest: the admin home page, as an email (and a short text).
//
// Sent by Vercel Cron (/api/cron/weekly-digest) and on demand from the admin
// home page. Built from buildAdminSummary so it says exactly what the
// dashboard says. Sections with nothing in them are left out, so a quiet
// week is a short email.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildAdminSummary } from '@/lib/adminSummary';
import { sendSms, smsConfigured } from '@/lib/sms';
import type { AdminSummary } from '@/types/adminSummary';
import { STAGE_LABEL } from '@/types/crm';

export type ChannelOutcome = 'sent' | 'failed' | 'skipped';

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function change(now: number, before: number) {
  if (!before) return '';
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? ' (same as the week before)' : ` (${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}%)`;
}

interface Section {
  title: string;
  lines: { text: string; href?: string; tone?: 'late' }[];
}

function sectionsOf(d: AdminSummary, site: string): Section[] {
  const sections: Section[] = [];
  const due = d.followUps.filter((t) => t.due_date <= d.today);
  const upcoming = d.followUps.filter((t) => t.due_date > d.today);

  if (d.followUps.length) {
    sections.push({
      title: `Follow-ups (${due.length} due now${upcoming.length ? `, ${upcoming.length} later this week` : ''})`,
      lines: [...due, ...upcoming].slice(0, 10).map((t) => ({
        text: `${t.title} — ${t.contact_name} · ${t.overdue ? `overdue since ${shortDate(t.due_date)}` : t.due_date === d.today ? 'today' : shortDate(t.due_date)}`,
        href: `${site}/admin/crm?contact=${t.contact_id}`,
        tone: t.overdue ? 'late' : undefined,
      })),
    });
  }

  if (d.upcomingCalls.length) {
    sections.push({
      title: `Calls this week (${d.upcomingCalls.length})`,
      lines: d.upcomingCalls.map((c) => ({
        text: `${new Date(c.starts_at).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} — ${c.name}${c.company ? `, ${c.company}` : ''}`,
        href: c.contact_id ? `${site}/admin/crm?contact=${c.contact_id}` : `${site}/admin/calls`,
      })),
    });
  }

  if (d.newInquiries.length) {
    sections.push({
      title: `New inquiries (${d.newInquiries.length})`,
      lines: d.newInquiries.slice(0, 10).map((i) => ({
        text: [i.name, i.project_type, i.budget && `budget ${i.budget}`, i.source && `via ${i.source}`].filter(Boolean).join(' · '),
        href: i.contact_id ? `${site}/admin/crm?contact=${i.contact_id}${i.deal_id ? `&deal=${i.deal_id}` : ''}` : `${site}/admin/crm`,
      })),
    });
  }

  if (d.proposalsAwaiting.length) {
    sections.push({
      title: `Waiting on a signature (${d.proposalsAwaiting.length})`,
      lines: d.proposalsAwaiting.slice(0, 10).map((p) => ({
        text: [
          `${p.title} — ${p.client_name}`,
          p.total_cents != null && money(p.total_cents),
          p.kind === 'builder' ? (p.viewed ? 'opened' : 'not opened') : 'uploaded PDF',
          p.since && `sent ${shortDate(p.since)}`,
        ].filter(Boolean).join(' · '),
        href: p.kind === 'builder' ? `${site}/admin/proposals/${p.id}/edit` : `${site}/admin/clients?client=${p.client_id}`,
      })),
    });
  }

  if (d.unpaidInvoices.length) {
    sections.push({
      title: `Unpaid invoices (${[
        d.unpaidTotals.overdue_cents && `${money(d.unpaidTotals.overdue_cents)} overdue`,
        d.unpaidTotals.due_cents && `${money(d.unpaidTotals.due_cents)} not yet due`,
      ].filter(Boolean).join(', ')})`,
      lines: d.unpaidInvoices.slice(0, 10).map((i) => ({
        text: `${i.client_name} · ${money(i.amount_cents)} · ${i.invoice_number} · ${i.overdue ? 'overdue' : 'due'} ${shortDate(i.due_date)}`,
        href: `${site}/admin/clients?client=${i.client_id}`,
        tone: i.overdue ? 'late' : undefined,
      })),
    });
  }

  if (d.reviewsToApprove.length || d.reviewCandidates.length) {
    sections.push({
      title: 'Reviews',
      lines: [
        ...d.reviewsToApprove.slice(0, 5).map((r) => ({
          text: `${r.display_name ?? 'A client'}${r.rating ? ` left ${'★'.repeat(r.rating)}` : ' left a review'} — approve it to put it on the site`,
          href: `${site}/admin/reviews`,
        })),
        ...d.reviewCandidates.map((c) => ({
          text: `Ask ${c.contact_name} for a review — ${c.deal_title}, won ${shortDate(c.won_at)}`,
          href: `${site}/admin/crm?contact=${c.contact_id}&deal=${c.deal_id}`,
        })),
      ],
    });
  }

  const st = d.pipeline.stages;
  sections.push({
    title: 'Pipeline',
    lines: [
      { text: `${money(d.pipeline.open_value_cents)} open across ${st.lead.count + st.contacted.count + st.proposal.count} deals — ${(['lead', 'contacted', 'proposal'] as const).map((k) => `${st[k].count} ${STAGE_LABEL[k].toLowerCase()}`).join(', ')}` },
      { text: `${money(d.pipeline.won_this_month_cents)} won so far this month` },
    ].map((l) => ({ ...l, href: `${site}/admin/crm` })),
  });

  if (d.traffic) {
    const t = d.traffic;
    const lines: Section['lines'] = [
      { text: `${t.visits} visits${change(t.visits, t.previous_visits)} and ${t.inquiries} inquir${t.inquiries === 1 ? 'y' : 'ies'} from the site${t.top_source ? `; most visits from ${t.top_source.source}` : ''}` },
    ];
    if (t.search) {
      lines.push({
        text: `${t.search.clicks} clicks from Google${change(t.search.clicks, t.search.previous_clicks)}, shown ${t.search.impressions.toLocaleString()} times${t.search.top_queries.length ? ` — top searches: ${t.search.top_queries.map((q) => `"${q.query}"`).join(', ')}` : ''}`,
      });
    }
    if (t.top_insight) {
      lines.push({ text: `This week's suggestion: ${t.top_insight.title}.${t.top_insight.actions[0] ? ` ${t.top_insight.actions[0]}` : ''}` });
    }
    sections.push({ title: 'The site this week', lines: lines.map((l) => ({ ...l, href: `${site}/admin/analytics` })) });
  }

  return sections;
}

export function renderDigest(d: AdminSummary, site: string) {
  const sections = sectionsOf(d, site);
  const due = d.followUps.filter((t) => t.due_date <= d.today).length;
  const headline = [
    due && `${due} follow-up${due === 1 ? '' : 's'} due`,
    d.newInquiries.length && `${d.newInquiries.length} new inquir${d.newInquiries.length === 1 ? 'y' : 'ies'}`,
    d.unpaidTotals.overdue_cents && `${money(d.unpaidTotals.overdue_cents)} overdue`,
  ].filter(Boolean).join(' · ') || 'A quiet week — nothing waiting on you';

  const dateLabel = new Date(`${d.today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const subject = `Thrive weekly: ${headline}`;

  const html = `
  <div style="margin:0;padding:0;background:#f6f5f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#111;">
    <div style="max-width:620px;margin:0 auto;padding:28px 20px;">
      <div style="font-size:12px;font-weight:700;color:#e40586;letter-spacing:.04em;">THRIVE CREATIVE STUDIOS · WEEKLY</div>
      <div style="font-size:22px;font-weight:800;margin:6px 0 2px;">${esc(dateLabel)}</div>
      <div style="font-size:14px;color:#555;margin-bottom:18px;">${esc(headline)}</div>
      ${sections.map((sec) => `
        <div style="background:#fff;border:1px solid #e4e1de;border-radius:12px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${esc(sec.title)}</div>
          ${sec.lines.map((l) => `
            <div style="font-size:13px;line-height:1.5;padding:5px 0;border-top:1px solid #f5f4f3;${l.tone === 'late' ? 'color:#b91c1c;' : ''}">
              ${l.href ? `<a href="${esc(l.href)}" style="color:inherit;text-decoration:none;">${esc(l.text)}</a>` : esc(l.text)}
            </div>`).join('')}
        </div>`).join('')}
      <a href="${esc(site)}/admin" style="display:inline-block;margin-top:6px;background:#e40586;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Open admin →</a>
    </div>
  </div>`;

  const text = [
    `Thrive weekly — ${dateLabel}`,
    headline,
    ...sections.map((sec) => [sec.title, ...sec.lines.map((l) => `- ${l.text}`)].join('\n')),
    `Open admin: ${site}/admin`,
  ].join('\n\n');

  const sms = `Thrive weekly: ${headline}. ${site}/admin`;

  return { subject, html, text, sms };
}

export async function sendWeeklyDigest(db: SupabaseClient, site: string): Promise<{ email: ChannelOutcome; sms: ChannelOutcome; error?: string }> {
  const summary = await buildAdminSummary(db);
  const digest = renderDigest(summary, site);

  let email: ChannelOutcome = 'skipped';
  let error: string | undefined;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_TO;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (apiKey && to && from) {
    try {
      const res = await new Resend(apiKey).emails.send({ from, to, subject: digest.subject, html: digest.html, text: digest.text });
      email = res.error ? 'failed' : 'sent';
      if (res.error) error = res.error.message;
    } catch (e) {
      email = 'failed';
      error = e instanceof Error ? e.message : 'Email failed';
    }
  } else {
    error = 'Email is not set up (RESEND_API_KEY, CONTACT_NOTIFY_TO, CONTACT_NOTIFY_FROM)';
  }

  let sms: ChannelOutcome = 'skipped';
  const phone = process.env.CONTACT_NOTIFY_PHONE;
  if (phone && smsConfigured()) {
    const result = await sendSms(phone, digest.sms);
    sms = result.ok ? 'sent' : 'failed';
    if (!result.ok) console.error('Digest text failed:', result.error);
  }

  if (email === 'failed') console.error('Digest email failed:', error);
  return { email, sms, error };
}
