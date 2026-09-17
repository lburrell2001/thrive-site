import type { Metadata } from 'next';
import PublicLayout from '../components/PublicLayout';
import s from '../components/legal.module.css';
import { buildPageMetadata } from '@/lib/seo';
import { SMS_SUPPORT_EMAIL } from '@/lib/smsConsent';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description:
    'What information Thrive Creative Studios collects through its website and client portal, how it is used, and your choices.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <main className={s.page}>
        <div className={s.inner}>
          <p className={s.eyebrow}>Legal</p>
          <h1 className={s.title}>Privacy Policy</h1>
          <p className={s.updated}>Effective September 17, 2026</p>

          <p>
            Thrive Creative Studios (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a creative studio based in Dallas,
            Texas. This policy explains what we collect through thrivecreativestudios.org and our client
            portal, and what we do with it.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Inquiries.</strong> When you use our contact form: your name, email, and what you tell us
              about your project, budget, and timeline.
            </li>
            <li>
              <strong>Client accounts.</strong> For clients with portal access: name, company, email address,
              and, if you choose to add it, a mobile number and your text message preference.
            </li>
            <li>
              <strong>Project information.</strong> Proposals, signatures, invoices, files, requests, and
              anything else exchanged while we work together, including the name, email, and IP address
              recorded when a proposal is signed or declined.
            </li>
            <li>
              <strong>Account logins you share with us.</strong> Credentials you save in the portal vault (for
              example, a website host or domain registrar) are encrypted before they are stored.
            </li>
            <li>
              <strong>Payments.</strong> Invoice payments are processed by Stripe. We do not see or store your
              full card number.
            </li>
            <li>
              <strong>Site usage.</strong> Basic, aggregated analytics about page visits.
            </li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To reply to inquiries and deliver the work you hire us for</li>
            <li>To send proposals, invoices, files, reminders, and updates about your project</li>
            <li>To process payments and keep business records</li>
            <li>To keep the site and portal secure and working</li>
          </ul>
          <p>We do not sell your personal information.</p>

          <h2>Text messages</h2>
          <p>
            If you opt in, we text you about invoices, proposals, delivered files, and reminders. See our{' '}
            <a href="/sms">Text Message Terms</a> for how to opt in and out. Reply STOP to any message to
            stop.
          </p>
          <p className={s.callout}>
            No mobile information will be shared with third parties or affiliates for marketing or promotional
            purposes. Text messaging originator opt-in data and consent are not shared with any third parties.
          </p>

          <h2>Who helps us run things</h2>
          <p>
            We use a small number of service providers who process data only to provide their service to us:
            Supabase (database, file storage, and portal login), Vercel (hosting and analytics), Stripe
            (payments), Resend (email), and Twilio (text messages). We may also disclose information if the law
            requires it.
          </p>

          <h2>How long we keep it</h2>
          <p>
            We keep client and project records for as long as we work together and afterward as needed for
            tax, legal, and business records. Inquiries that do not become projects are deleted when no
            longer needed.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>Update your name, company, mobile number, and text preference in portal settings.</li>
            <li>Stop texts at any time by replying STOP.</li>
            <li>
              Ask us for a copy of your information, or to correct or delete it, by emailing{' '}
              <a href={`mailto:${SMS_SUPPORT_EMAIL}`}>{SMS_SUPPORT_EMAIL}</a>.
            </li>
          </ul>

          <h2>Changes</h2>
          <p>If we change this policy, we will update the date at the top of this page.</p>

          <h2>Contact</h2>
          <p>
            Thrive Creative Studios · Dallas, TX ·{' '}
            <a href={`mailto:${SMS_SUPPORT_EMAIL}`}>{SMS_SUPPORT_EMAIL}</a>
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}
