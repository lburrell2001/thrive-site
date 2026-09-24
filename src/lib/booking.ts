// "Book a call": reading availability, taking a booking, cancelling one.
//
// A booking is also written as a contact_inquiries row, so the CRM
// triggers attach it to a contact and deal exactly as they do for the
// contact form, and analytics counts it as an inquiry with its source.
// Both sides get an email with a calendar invite (.ics).

import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { attributionFor, type AttributionInput } from '@/lib/inquiryAttribution';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import { textAgency } from '@/lib/sms';
import {
  WEEKDAYS,
  describeTime,
  localDate,
  openSlots,
  type Blackout,
  type BookingSettings,
  type DaySlots,
} from '@/lib/bookingTime';

export class BookingError extends Error {}

const SERVICE_SLUGS = Object.keys(SERVICE_SEO) as [ServiceSlug, ...ServiceSlug[]];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour times like 09:30');

export const settingsSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(3).max(80),
  duration_minutes: z.number().int().min(10).max(120),
  buffer_minutes: z.number().int().min(0).max(120),
  min_notice_hours: z.number().int().min(0).max(336),
  max_days_ahead: z.number().int().min(1).max(90),
  // Partial: days left out are simply unavailable.
  weekly_hours: z.partialRecord(
    z.enum(WEEKDAYS),
    z.array(z.object({ start: time, end: time }).refine((w) => w.start < w.end, 'Each block must end after it starts')).max(4),
  ),
  meeting_link: z.string().trim().url('Enter a full link, e.g. https://meet.google.com/…').nullable().or(z.literal('').transform(() => null)),
  meeting_note: z.string().trim().max(300),
}).partial();

export const bookSchema = z.object({
  starts_at: z.string().datetime(),
  name: z.string().trim().min(1, 'Add your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  company: z.string().trim().max(160).optional().transform((v) => v || null),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  service_slug: z.enum(SERVICE_SLUGS).nullish(),
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
  visitor_tz: z.string().max(64).optional(),
  attribution: z.unknown().optional(),
  // Honeypot: a real visitor never fills this in.
  website: z.string().max(0, 'Please leave that field empty').optional(),
});

export async function loadSettings(db: SupabaseClient): Promise<BookingSettings> {
  const { data, error } = await db.from('booking_settings').select('*').eq('id', 1).single();
  if (error || !data) throw new BookingError('Booking is not set up yet');
  return data as BookingSettings;
}

export async function availability(db: SupabaseClient): Promise<{ settings: BookingSettings; days: DaySlots[] }> {
  const settings = await loadSettings(db);
  if (!settings.enabled) return { settings, days: [] };
  const [blackouts, busy] = await Promise.all([
    db.from('booking_blackouts').select('starts_on, ends_on').gte('ends_on', localDate(Date.now(), settings.timezone)),
    db.from('bookings').select('starts_at, ends_at').eq('status', 'confirmed').gte('ends_at', new Date().toISOString()),
  ]);
  return {
    settings,
    days: openSlots(settings, (blackouts.data ?? []) as Blackout[], busy.data ?? []),
  };
}

function validZone(tz: string | undefined) {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- invites

function icsDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

/** A calendar file both sides can add. METHOD:CANCEL removes it again. */
function ics(b: { id: string; starts_at: string; ends_at: string }, summary: string, description: string, location: string | null, cancel = false) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Thrive Creative Studios//Booking//EN',
    `METHOD:${cancel ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${b.id}@thrivecreativestudios.org`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.starts_at)}`,
    `DTEND:${icsDate(b.ends_at)}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(location ? [`LOCATION:${icsText(location)}`] : []),
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`,
    `SEQUENCE:${cancel ? 1 : 0}`,
    ...(cancel ? [] : ['BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Call in 30 minutes', 'END:VALARM']),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emailHtml(heading: string, lines: string[], button?: { href: string; label: string }) {
  return `
  <div style="margin:0;padding:0;background:#f6f5f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
      <div style="font-size:12px;font-weight:700;color:#e40586;letter-spacing:.04em;">THRIVE CREATIVE STUDIOS</div>
      <div style="background:#fff;border:1px solid #e4e1de;border-radius:14px;padding:22px;margin-top:10px;">
        <div style="font-size:20px;font-weight:800;margin-bottom:10px;">${esc(heading)}</div>
        ${lines.map((l) => `<div style="font-size:14px;line-height:1.6;color:#333;margin:6px 0;white-space:pre-line;">${esc(l)}</div>`).join('')}
        ${button ? `<a href="${esc(button.href)}" style="display:inline-block;margin-top:14px;background:#e40586;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">${esc(button.label)}</a>` : ''}
      </div>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string, text: string, invite?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  if (!apiKey || !from) return;
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
      text,
      ...(invite ? { attachments: [{ filename: 'invite.ics', content: Buffer.from(invite).toString('base64') }] } : {}),
    });
    if (error) console.error('Booking email failed:', error.message);
  } catch (e) {
    console.error('Booking email failed:', e);
  }
}

// ---------------------------------------------------------------- booking

export async function createBooking(
  db: SupabaseClient,
  input: z.infer<typeof bookSchema>,
  site: string,
  host: string | null,
) {
  const { settings, days } = await availability(db);
  if (!settings.enabled) throw new BookingError('Booking is closed right now — please use the contact form.');

  const startsAt = new Date(input.starts_at).toISOString();
  if (!days.some((d) => d.slots.includes(startsAt))) {
    throw new BookingError('That time is no longer available. Please pick another.');
  }
  const endsAt = new Date(Date.parse(startsAt) + settings.duration_minutes * 60_000).toISOString();
  const visitorTz = validZone(input.visitor_tz) ?? settings.timezone;
  const service = input.service_slug ? SERVICE_SEO[input.service_slug] : null;
  const token = randomBytes(24).toString('base64url');

  const { data: booking, error } = await db
    .from('bookings')
    .insert({
      token,
      starts_at: startsAt,
      ends_at: endsAt,
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      service_slug: input.service_slug ?? null,
      notes: input.notes,
      visitor_tz: visitorTz,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new BookingError('Someone just booked that time. Please pick another.');
    throw new BookingError(error.message);
  }

  const studioTime = describeTime(startsAt, settings.timezone);
  const visitorTime = describeTime(startsAt, visitorTz);

  // The CRM side: an inquiry (which the triggers turn into a contact and
  // deal), and a follow-up task on the day of the call.
  const attribution = await attributionFor(db, input.attribution as AttributionInput | undefined, host);
  const basic = {
    name: input.name,
    email: input.email,
    project_type: service?.name ?? null,
    message: [`Booked a ${settings.title.toLowerCase()} for ${studioTime}.`, input.notes].filter(Boolean).join('\n\n'),
    status: 'new',
    page_url: `${site}/book`,
  };
  const columns = 'id, crm_contact_id, crm_deal_id';
  let { data: inq } = await db
    .from('contact_inquiries')
    .insert({ ...basic, company: input.company, ...(attribution ?? {}) })
    .select(columns)
    .single();
  if (!inq) {
    // A newer inquiry column may be missing (migrations 020/024); the
    // booking still stands and still reaches the CRM.
    ({ data: inq } = await db.from('contact_inquiries').insert(basic).select(columns).single());
  }

  let taskId: string | null = null;
  if (inq?.crm_contact_id) {
    const { data: task } = await db
      .from('crm_tasks')
      .insert({ contact_id: inq.crm_contact_id, title: `Intro call — ${studioTime.split(' at ')[1]}`, due_date: localDate(Date.parse(startsAt), settings.timezone) })
      .select('id')
      .single();
    taskId = task?.id ?? null;
  }
  await db.from('bookings').update({
    inquiry_id: inq?.id ?? null,
    crm_contact_id: inq?.crm_contact_id ?? null,
    crm_deal_id: inq?.crm_deal_id ?? null,
    crm_task_id: taskId,
  }).eq('id', booking.id);

  // Emails with the invite, and a text to Lauren.
  const where = settings.meeting_link ?? settings.meeting_note;
  const manage = `${site}/book/${token}`;
  const summary = `${settings.title} — Thrive Creative Studios`;
  await Promise.all([
    sendEmail(
      input.email,
      `Booked: ${settings.title} on ${visitorTime}`,
      emailHtml(`You're booked, ${input.name.split(' ')[0]}!`, [
        `${settings.title} with Lauren at Thrive Creative Studios.`,
        `When: ${visitorTime}`,
        `Where: ${where}`,
        'The calendar invite is attached. If something comes up, you can cancel below.',
      ], { href: manage, label: 'Cancel or rebook' }),
      `You're booked: ${settings.title}\nWhen: ${visitorTime}\nWhere: ${where}\n\nCancel or rebook: ${manage}`,
      ics(booking, summary, `${settings.title} with Lauren at Thrive Creative Studios.\n${where}\n\nCancel or rebook: ${manage}`, settings.meeting_link),
    ),
    process.env.CONTACT_NOTIFY_TO
      ? sendEmail(
          process.env.CONTACT_NOTIFY_TO,
          `New call booked: ${input.name} — ${studioTime}`,
          emailHtml('New call booked', [
            `${input.name}${input.company ? `, ${input.company}` : ''} — ${input.email}${input.phone ? ` · ${input.phone}` : ''}`,
            `When: ${studioTime}`,
            service ? `About: ${service.name}` : '',
            input.notes ? `Notes: ${input.notes}` : '',
          ].filter(Boolean), inq?.crm_contact_id ? { href: `${site}/admin/crm?contact=${inq.crm_contact_id}`, label: 'Open in CRM' } : undefined),
          `New call booked: ${input.name} (${input.email}) — ${studioTime}${input.notes ? `\n\n${input.notes}` : ''}`,
          ics(booking, `Call: ${input.name}${input.company ? ` (${input.company})` : ''}`, `${input.email}${input.phone ? ` · ${input.phone}` : ''}\n${input.notes ?? ''}`, settings.meeting_link),
        )
      : Promise.resolve(),
    textAgency(`New call booked: ${input.name} — ${studioTime}`),
  ]);

  return { id: booking.id as string, starts_at: startsAt, token, visitorTime, where };
}

export async function cancelBooking(
  db: SupabaseClient,
  by: { token: string } | { id: string },
  cancelledBy: 'visitor' | 'admin',
  site: string,
) {
  const query = db.from('bookings').select('*').eq('status', 'confirmed');
  const { data: booking } = await ('token' in by ? query.eq('token', by.token) : query.eq('id', by.id)).maybeSingle();
  if (!booking) throw new BookingError('That booking was not found or is already cancelled.');

  await db.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: cancelledBy }).eq('id', booking.id);
  if (booking.crm_task_id) await db.from('crm_tasks').delete().eq('id', booking.crm_task_id).is('completed_at', null);
  if (booking.crm_contact_id) {
    await db.from('crm_activities').insert({
      contact_id: booking.crm_contact_id,
      deal_id: booking.crm_deal_id,
      kind: 'note',
      body: `Intro call on ${describeTime(booking.starts_at, 'America/Chicago')} was cancelled by ${cancelledBy === 'visitor' ? 'them' : 'you'}.`,
    });
  }

  const settings = await loadSettings(db);
  const visitorTime = describeTime(booking.starts_at, booking.visitor_tz ?? settings.timezone);
  const studioTime = describeTime(booking.starts_at, settings.timezone);
  const cancelInvite = ics(booking, `${settings.title} — Thrive Creative Studios`, 'Cancelled', null, true);

  await Promise.all([
    sendEmail(
      booking.email,
      `Cancelled: ${settings.title} on ${visitorTime}`,
      emailHtml('Your call is cancelled', [
        `${settings.title} on ${visitorTime} is cancelled${cancelledBy === 'admin' ? ' — sorry for the change. Please pick another time that works for you.' : '.'}`,
      ], { href: `${site}/book`, label: 'Book another time' }),
      `Your ${settings.title} on ${visitorTime} is cancelled. Book another time: ${site}/book`,
      cancelInvite,
    ),
    cancelledBy === 'visitor' && process.env.CONTACT_NOTIFY_TO
      ? sendEmail(process.env.CONTACT_NOTIFY_TO, `Call cancelled: ${booking.name} — ${studioTime}`, emailHtml('Call cancelled', [`${booking.name} cancelled their call on ${studioTime}.`]), `${booking.name} cancelled their call on ${studioTime}.`, cancelInvite)
      : Promise.resolve(),
    cancelledBy === 'visitor' ? textAgency(`Call cancelled: ${booking.name} — ${studioTime}`) : Promise.resolve(),
  ]);
}
