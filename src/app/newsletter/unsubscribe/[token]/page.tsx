import type { Metadata } from 'next';
import PublicLayout from '../../../components/PublicLayout';
import UnsubscribeButton from './UnsubscribeButton';
import s from '../../newsletter.module.css';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

// The page itself changes nothing: security scanners open links in
// emails, and that must not unsubscribe anyone. The button does it.
export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  return (
    <PublicLayout>
      <div className={s.page}>
        <div className={s.card}>
          <p className={s.eyebrow}>Newsletter</p>
          <h1 className={s.title}>UNSUBSCRIBE</h1>
          <UnsubscribeButton token={token} />
        </div>
      </div>
    </PublicLayout>
  );
}
