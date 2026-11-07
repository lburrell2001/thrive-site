import type { Metadata } from 'next';
import Link from 'next/link';
import Shell from '../../../_site/Shell';
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
    confirmed: { title: "You’re in!", text: 'Thanks for subscribing. Expect the occasional email with new work, practical advice, and studio news — never spam.' },
    unsubscribed: { title: 'You unsubscribed', text: 'You unsubscribed after this link was sent, so we left it that way. Sign up again from the footer any time.' },
    invalid: { title: 'Link not valid', text: 'This confirmation link is not valid. Try signing up again from the footer of any page.' },
  }[result];

  return (
    <Shell>
      <div className={s.page}>
        <div className={s.card}>
          <h1 className={s.title}>{copy.title}</h1>
          <p className={s.text}>{copy.text}</p>
          <p className={s.text}><Link href="/journal">Read the journal →</Link></p>
        </div>
      </div>
    </Shell>
  );
}
