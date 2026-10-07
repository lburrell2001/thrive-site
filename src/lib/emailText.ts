// Text helpers shared by the email renderers: escaping, links, and the
// small inline markdown (**bold**, *italic*, [link](/page)) emails allow.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

export function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Relative links become absolute; anything but http(s)/mailto is dropped. */
export function href(url: string, site: string): string | null {
  const u = url.trim();
  if (u.startsWith('/')) return `${site}${u}`;
  return /^(https?:|mailto:)/i.test(u) ? u : null;
}

/** Bold, italic and link text are rendered again, so a link inside bold still works. */
export function inlineHtml(text: string, site: string, linkColor = '#e40586'): string {
  return text.split(INLINE).filter(Boolean).map((t) => {
    if (t.startsWith('**') && t.endsWith('**')) return `<strong>${inlineHtml(t.slice(2, -2), site, linkColor)}</strong>`;
    if (t.startsWith('*') && t.endsWith('*')) return `<em>${inlineHtml(t.slice(1, -1), site, linkColor)}</em>`;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
    if (link) {
      const h = href(link[2], site);
      const label = inlineHtml(link[1], site, linkColor);
      return h ? `<a href="${esc(h)}" style="color:${linkColor};text-decoration:underline;">${label}</a>` : label;
    }
    return esc(t);
  }).join('');
}

export function inlineText(text: string, site: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const h = href(url, site);
      return h ? `${label} (${h})` : label;
    });
}
