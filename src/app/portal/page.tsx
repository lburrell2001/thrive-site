import { redirect } from 'next/navigation';

// "Your client portal is ready" emails linked to plain /portal: send them in
// (the portal layout sends anyone signed out to the login page).
export default function PortalHome() {
  redirect('/portal/dashboard');
}
