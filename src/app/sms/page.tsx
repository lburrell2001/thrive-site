import type { Metadata } from 'next';
import PublicLayout from '../components/PublicLayout';
import s from '../components/legal.module.css';
import { buildPageMetadata } from '@/lib/seo';
import {
  SMS_CONSENT_LABEL,
  SMS_CONSENT_SUMMARY,
  SMS_CONSENT_TEXT,
  SMS_PROGRAM_NAME,
  SMS_SUPPORT_EMAIL,
} from '@/lib/smsConsent';

export const metadata: Metadata = buildPageMetadata({
  title: 'Text Message Terms',
  description:
    'How Thrive Creative Studios clients opt in to text message updates, what we send, and how to opt out.',
  path: '/sms',
});

// Public on purpose: carriers reviewing our toll-free verification need to
// see the opt-in without a portal login.
export default function SmsTermsPage() {
  return (
    <PublicLayout>
      <main className={s.page}>
        <div className={s.inner}>
          <p className={s.eyebrow}>Client Updates by Text</p>
          <h1 className={s.title}>Text Message Terms</h1>
          <p className={s.updated}>Last updated September 17, 2026</p>

          <h2>The program</h2>
          <p>
            <strong>{SMS_PROGRAM_NAME}</strong> sends transactional text messages to existing clients of
            Thrive Creative Studios about their own work with us:
          </p>
          <ul>
            <li>New invoices and payment reminders</li>
            <li>Proposals ready for review and signature</li>
            <li>Project files delivered to the client portal</li>
            <li>Onboarding reminders and messages about an active project</li>
          </ul>
          <p>We do not send marketing or promotional texts.</p>

          <h2>How clients opt in</h2>
          <p>
            Texts are off by default. A client turns them on in their client portal under{' '}
            <strong>Settings → Profile</strong> by entering a mobile number and checking the box below.
            Clients can uncheck it at any time. This is exactly what they see:
          </p>

          <div className={s.mockCard} aria-label="Opt-in as shown in client portal settings">
            <div className={s.mockBar} />
            <div className={s.mockBody}>
              <div>
                <span className={s.mockLabel}>Mobile</span>
                <div className={s.mockInput}>(555) 123-4567</div>
              </div>
              <label className={s.mockCheck}>
                <input type="checkbox" disabled aria-label={SMS_CONSENT_LABEL} />
                <span>
                  <strong>{SMS_CONSENT_LABEL}</strong> — {SMS_CONSENT_SUMMARY}
                  <span className={s.mockFine}>{SMS_CONSENT_TEXT}</span>
                </span>
              </label>
            </div>
          </div>
          <p className={s.caption}>
            The opt-in checkbox from the client portal. It is never pre-checked.
          </p>
          <p>
            A client may also give consent directly to Thrive Creative Studios in writing or in person, in
            which case we record it on their account. Consent is never a condition of doing business with
            us.
          </p>

          <h2>Message frequency and cost</h2>
          <p>
            Message frequency varies with project activity, typically a few messages per month. Message and
            data rates may apply, depending on your mobile plan.
          </p>

          <h2>Opting out and help</h2>
          <p className={s.callout}>
            Reply STOP to any message to stop receiving texts. Reply HELP for help.
          </p>
          <p>
            After you reply STOP, we send one confirmation and no further texts. You can also turn texts off
            in portal settings, or email <a href={`mailto:${SMS_SUPPORT_EMAIL}`}>{SMS_SUPPORT_EMAIL}</a>.
            Carriers are not liable for delayed or undelivered messages.
          </p>

          <h2>Example message</h2>
          <p className={s.sample}>
            Thrive Creative Studios: Friendly reminder, invoice INV-004 for $1,200 is due Sep 20. Pay here:
            https://thrivecreativestudios.org/portal/invoices{'\n\n'}Reply STOP to opt out.
          </p>

          <h2>Privacy</h2>
          <p>
            Mobile numbers and text message consent are never sold, rented, or shared with third parties or
            affiliates for marketing purposes. See our <a href="/privacy">Privacy Policy</a> for details.
          </p>

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
