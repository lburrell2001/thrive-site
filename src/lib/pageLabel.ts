// A readable name for a site path, for visitor histories. Pure.

const NAMED: Record<string, string> = {
  '/': 'Home',
  '/services': 'Services',
  '/services/digital-design': 'Web Development',
  '/services/brand-design': 'Branding',
  '/services/ux-design': 'UX Design',
  '/services/social-media': 'Social Media',
  '/services/photography': 'Photography',
  '/work': 'Work',
  '/about': 'About',
  '/contact': 'Contact',
  '/book': 'Book a call',
  '/journal': 'Journal',
  '/amarillo-web-design': 'Amarillo Web Design',
  '/privacy': 'Privacy',
};

export function pageLabel(path: string): string {
  if (NAMED[path]) return NAMED[path];
  const parts = path.split('/').filter(Boolean);
  const words = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (parts[0] === 'work' && parts[1]) return `Work: ${words(parts[1])}`;
  if (parts[0] === 'journal' && parts[1]) return `Journal: ${words(parts[1])}`;
  return words(parts[parts.length - 1] ?? path);
}

/** Pages that say what someone might hire for. */
export function isServicePage(path: string): boolean {
  return /^\/services\/[^/]+$/.test(path) || path === '/amarillo-web-design';
}
