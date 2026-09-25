import type { Metadata } from 'next';
import Link from 'next/link';
import PublicLayout from '../../../components/PublicLayout';
import { serviceClient } from '@/lib/adminAuth';
import { confirmSubscription } from '@/lib/newsletter';
import s from '../../newsletter.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Subscription', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default async function ConfirmPage({ params }: Props) {
  const { token } = await params;
  const result = await confirmSubscription(serviceClient(), token);

  const copy = {
    confirmed: { title: "YOU'RE IN!", text: 'Thanks for subscribing. Expect the occasional email with new work, practical advice, and studio news — never spam.' },
    unsubscribed: { title: 'YOU UNSUBSCRIBED', text: 'You unsubscribed after this link was sent, so we left it that way. Sign up again from the footer any time.' },
    invalid: { title: 'LINK NOT VALID', text: 'This confirmation link is not valid. Try signing up again from the footer of any page.' },
  }[result];

  return (
    <PublicLayout>
      <div className={s.page}>
        <div className={s.card}>
          <p className={s.eyebrow}>Newsletter</p>
          <h1 className={s.title}>{copy.title}</h1>
          <p className={s.text}>{copy.text}</p>
          <p className={s.text}><Link href="/journal">Read the journal →</Link></p>
        </div>
      </div>
    </PublicLayout>
  );
}
