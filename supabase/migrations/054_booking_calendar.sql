-- 054: calls booked on /book go on an Outlook calendar.
--
-- booking_settings.calendar_mailbox: whose calendar each new booking is added
-- to (Lauren's own address or a mailbox she has Full Access to, e.g.
-- hello@thrivecreativestudios.org); null = don't add it. Needs the Outlook
-- connection to hold Calendars.ReadWrite(.Shared) (Settings → Email →
-- Reconnect).
-- bookings.outlook_event_id / outlook_mailbox: the event made for a booking,
-- so cancelling it removes the event too.
--
-- Safe to run more than once.

alter table public.booking_settings add column if not exists calendar_mailbox text;
alter table public.bookings
  add column if not exists outlook_event_id text,
  add column if not exists outlook_mailbox  text;

-- Lauren asked for hello@'s calendar (2026-11-10). Changeable in Settings → Booking.
update public.booking_settings set calendar_mailbox = 'hello@thrivecreativestudios.org' where id = 1 and calendar_mailbox is null;
