// Internal links in the site's new components go through rd(). The redesign
// was staged under /redesign (Nov 2026), where rd() kept links inside the
// preview; it's live now, so it returns the address unchanged. Kept so a
// future staged redesign can reuse the same hook.

export function rd(href: string): string {
  return href;
}
