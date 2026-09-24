import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Book a Free Intro Call',
  description:
    'Pick a time for a short intro call with Thrive Creative Studios, a Dallas creative studio for branding, websites, UX, social media and photography.',
  path: '/book',
});

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
