import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicLayout from '../../components/PublicLayout';
import { serviceClient } from '@/lib/adminAuth';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import ReviewForm from './ReviewForm';
import s from '../review.module.css';

export const dynamic = 'force-dynamic';

// A private link: never indexed.
export const metadata: Metadata = {
  title: 'Leave a review',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  const { data: review } = await serviceClient()
    .from('reviews')
    .select('status, display_name, service_slug')
    .eq('token', token)
    .maybeSingle();
  if (!review) notFound();

  const service = review.service_slug ? SERVICE_SEO[review.service_slug as ServiceSlug]?.name : null;
  const googleReviewUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || null;

  return (
    <PublicLayout>
      <div className={s.page}>
        <div className={s.card}>
          <p className={s.eyebrow}>Thrive Creative Studios</p>
          {review.status === 'requested' ? (
            <>
              <h1 className={s.title}>HOW DID WE DO?</h1>
              <p className={s.lede}>
                {service ? `A few words about your ${service.toLowerCase()} project` : 'A few words about working together'} help other
                businesses decide whether we are the right fit. It takes two minutes.
              </p>
              <ReviewForm token={token} defaultName={review.display_name ?? ''} googleReviewUrl={googleReviewUrl} />
            </>
          ) : (
            <>
              <h1 className={s.title}>THANK YOU!</h1>
              <p className={s.lede}>Your review has already been sent. It means a lot.</p>
              {googleReviewUrl && (
                <a href={googleReviewUrl} className={s.google} target="_blank" rel="noreferrer">Also leave it on Google →</a>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
