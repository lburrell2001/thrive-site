import { SMS_OPT_IN_TEXT, SMS_TERMS_URL_TEXT } from '@/lib/smsConsent';

/** The text-message opt-in checkbox label, shared by the portal and /sms. */
export default function SmsOptInLabel({ linkStyle, newTab }: { linkStyle?: React.CSSProperties; newTab?: boolean }) {
  return (
    <span>
      {SMS_OPT_IN_TEXT}{' '}
      <a href="/sms" style={linkStyle} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>Text Terms</a>
      : {SMS_TERMS_URL_TEXT}
    </span>
  );
}
