// Scheduled sends (migration 053): a proposal, estimate or invoice set to go
// out later. The Send dialog posts what it would have sent, plus a time; the
// five-minute cron (sendDueEmails → sendDueScheduled) claims each due row and
// sends it with the same code as Send now:
//   proposal → sendProposalEmail (publishes it, emails the button)
//   estimate → sendEstimateEmail (emails the PDF made when it was scheduled)
//   invoice  → createPortalInvoice (the invoice only exists once it's sent,
//              so the client never sees it early), then the client's email/text
// A failure leaves the row `failed` with the reason, and Lauren is emailed.
// Emails (newsletters, one-to-one drafts) have their own scheduling (032).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { notifyPortalClient } from './clientNotify';
import { createPortalInvoice } from './invoiceCreate';
import { estimateSendSchema, sendEstimateEmail } from './estimateSend';
import { proposalSendSchema, sendProposalEmail } from './proposalSend';
import { scheduleProblem } from './scheduleTime';

export type SendKind = 'proposal' | 'estimate' | 'invoice';
export type ScheduledSend = {
  id: string; kind: SendKind; target_id: string | null; label: string; send_at: string;
  status: 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'; error: string | null; created_at: string;
  /** For invoices: the client and number, so the list can show it. */
  client_id?: string | null; invoice_number?: string | null; amount_cents?: number | null; project_name?: string | null;
};

const invoicePayload = z.object({
  /** Exactly what the builder posts to the add_invoice action. */
  params: z.record(z.string(), z.unknown()).refine((p) => typeof p.clientId === 'string' && typeof p.invoice_number === 'string', 'Missing the client or invoice number'),
  /** Turned into from an estimate: mark it invoiced once the invoice exists. */
  from_estimate_id: z.string().uuid().nullable().optional(),
});

const PAYLOADS = { proposal: proposalSendSchema, estimate: estimateSendSchema, invoice: invoicePayload } as const;

const missingTable = (msg: string) => /scheduled_sends/.test(msg) && /does not exist|schema cache/.test(msg);
const NEEDS_053 = 'Run migration 053 in Supabase to schedule sends.';

export async function scheduleSend(db: SupabaseClient, input: { kind: SendKind; target_id?: string | null; label?: string; payload: unknown; send_at: string }) {
  const at = new Date(input.send_at);
  const problem = scheduleProblem(at);
  if (problem) return { ok: false as const, error: problem };
  const payload = PAYLOADS[input.kind].safeParse(input.payload);
  if (!payload.success) return { ok: false as const, error: payload.error.issues[0]?.message ?? 'Check what you’re sending' };
  const target = input.kind === 'invoice' ? null : input.target_id ?? null;
  if (input.kind !== 'invoice' && !target) return { ok: false as const, error: 'Missing what to send' };
  // One schedule per proposal or estimate: a new time replaces the old one.
  if (target) await db.from('scheduled_sends').update({ status: 'cancelled' }).eq('kind', input.kind).eq('target_id', target).eq('status', 'scheduled');
  const { data, error } = await db.from('scheduled_sends').insert({
    kind: input.kind, target_id: target, label: (input.label ?? '').slice(0, 300), payload: payload.data, send_at: at.toISOString(),
  }).select('id, send_at').single();
  if (error) return { ok: false as const, error: missingTable(error.message) ? NEEDS_053 : error.message };
  return { ok: true as const, id: data.id as string, send_at: data.send_at as string };
}

export async function cancelSend(db: SupabaseClient, id: string) {
  // A failed one can be dismissed the same way.
  const { error } = await db.from('scheduled_sends').update({ status: 'cancelled' }).eq('id', id).in('status', ['scheduled', 'failed']);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** What's waiting (and what failed in the last two weeks), soonest first. Empty before 053. */
export async function listSends(db: SupabaseClient): Promise<ScheduledSend[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data, error } = await db.from('scheduled_sends').select('id, kind, target_id, label, send_at, status, error, created_at, payload')
    .or(`status.in.(scheduled,sending),and(status.eq.failed,send_at.gte.${since})`)
    .order('send_at');
  if (error) return [];
  return (data ?? []).map(({ payload, ...r }) => {
    const p = (r.kind === 'invoice' ? (payload as { params?: Record<string, unknown> })?.params : null) ?? null;
    return {
      ...r,
      client_id: typeof p?.clientId === 'string' ? p.clientId : null,
      invoice_number: typeof p?.invoice_number === 'string' ? p.invoice_number : null,
      project_name: typeof p?.project_name === 'string' ? p.project_name : null,
      amount_cents: p ? invoiceTotal(p) : null,
    } as ScheduledSend;
  });
}

function invoiceTotal(p: Record<string, unknown>): number | null {
  if (Array.isArray(p.line_items)) return (p.line_items as { amount_cents?: number }[]).reduce((n, l) => n + (Number(l.amount_cents) || 0), 0);
  return Number.isFinite(Number(p.amount_cents)) ? Number(p.amount_cents) : null;
}

/** Invoice numbers already promised to scheduled invoices for this client (so the next number skips them). */
export async function scheduledInvoiceNumbers(db: SupabaseClient, clientId: string): Promise<string[]> {
  const { data, error } = await db.from('scheduled_sends').select('payload').eq('kind', 'invoice').in('status', ['scheduled', 'sending', 'failed']);
  if (error) return [];
  return (data ?? []).map((r) => (r.payload as { params?: Record<string, unknown> })?.params)
    .filter((p) => p?.clientId === clientId && typeof p?.invoice_number === 'string')
    .map((p) => p!.invoice_number as string);
}

async function run(db: SupabaseClient, row: { kind: SendKind; target_id: string | null; payload: unknown }): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  if (row.kind === 'proposal') {
    const r = await sendProposalEmail(db, row.target_id!, proposalSendSchema.parse(row.payload));
    return r.ok ? { ok: true, result: { to: r.to, url: r.url } } : r;
  }
  if (row.kind === 'estimate') {
    const r = await sendEstimateEmail(db, row.target_id!, estimateSendSchema.parse(row.payload));
    return r.ok ? { ok: true, result: { to: r.to } } : r;
  }
  const { params, from_estimate_id } = invoicePayload.parse(row.payload);
  const made = await createPortalInvoice(db, params);
  if (!made.ok) return made;
  if (from_estimate_id) {
    await db.from('estimates').update({ status: 'invoiced', invoice_id: made.invoice.id, updated_at: new Date().toISOString() }).eq('id', from_estimate_id);
  }
  await notifyPortalClient(db, made.clientId, made.notice);
  return { ok: true, result: { invoice_id: made.invoice.id } };
}

export type SendFailure = { what: string; error: string; href: string };

/** Sends everything due. Each row is claimed first, so overlapping runs can't send twice. */
export async function sendDueScheduled(db: SupabaseClient, site: string): Promise<{ sent: number; failures: SendFailure[] }> {
  const { data: due, error } = await db.from('scheduled_sends').select('id, kind, target_id, label, payload')
    .eq('status', 'scheduled').lte('send_at', new Date().toISOString()).order('send_at').limit(25);
  if (error || !due?.length) return { sent: 0, failures: [] };
  let sent = 0;
  const failures: SendFailure[] = [];
  for (const row of due) {
    const { data: claimed } = await db.from('scheduled_sends').update({ status: 'sending' }).eq('id', row.id).eq('status', 'scheduled').select('id').maybeSingle();
    if (!claimed) continue;
    let outcome: Awaited<ReturnType<typeof run>>;
    try {
      outcome = await run(db, row as { kind: SendKind; target_id: string | null; payload: unknown });
    } catch (e) {
      outcome = { ok: false, error: e instanceof Error ? e.message : 'Could not send' };
    }
    if (outcome.ok) {
      sent += 1;
      await db.from('scheduled_sends').update({ status: 'sent', sent_at: new Date().toISOString(), result: outcome.result ?? null, error: null }).eq('id', row.id);
    } else {
      await db.from('scheduled_sends').update({ status: 'failed', error: outcome.error.slice(0, 500) }).eq('id', row.id);
      const href = row.kind === 'proposal' ? `${site}/admin/crm/proposals/${row.target_id}/edit` : `${site}/admin/invoices`;
      failures.push({ what: row.label || `A scheduled ${row.kind}`, error: outcome.error, href });
    }
  }
  return { sent, failures };
}
