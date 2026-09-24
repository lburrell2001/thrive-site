import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicLayout from '../../components/PublicLayout';
import { serviceClient } from '@/lib/adminAuth';
import { describeTime } from '@/lib/bookingTime';
import CancelButton from './CancelButton';
import s from '../book.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

function hasPassed(iso: string) {
  return Date.parse(iso) < Date.now();
}

export default async function ManageBooking({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  const { data: booking } = await serviceClient()
    .from('bookings')
    .select('starts_at, status, visitor_tz, name')
    .eq('token', token)
    .maybeSingle();
  if (!booking) notFound();

  const when = describeTime(booking.starts_at, booking.visitor_tz ?? 'America/Chicago');
  const past = hasPassed(booking.starts_at);

  return (
    <PublicLayout>
      <div className={s.page}>
        <div className={s.head}>
          <p className={s.eyebrow}>Your booking</p>
          <h1 className={s.title}>{booking.status === 'cancelled' ? 'CANCELLED' : past ? 'THANKS FOR TALKING' : 'SEE YOU SOON'}</h1>
        </div>
        <div className={s.panel} style={{ maxWidth: 560 }}>
          <p className={s.lede}><strong>{when}</strong></p>
          {booking.status === 'cancelled' ? (
            <p className={s.lede}>This call is cancelled. <Link href="/book">Book another time →</Link></p>
          ) : past ? (
            <p className={s.lede}>This call has already happened.</p>
          ) : (
            <>
              <p className={s.lede}>Need a different time? Cancel this one, then pick a new slot.</p>
              <CancelButton token={token} />
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
