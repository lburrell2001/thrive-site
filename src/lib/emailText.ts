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

export function inlineHtml(text: string, site: string, linkColor = '#e40586') {
  return text.split(INLINE).filter(Boolean).map((t) => {
    if (t.startsWith('**') && t.endsWith('**')) return `<strong>${esc(t.slice(2, -2))}</strong>`;
    if (t.startsWith('*') && t.endsWith('*')) return `<em>${esc(t.slice(1, -1))}</em>`;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
    if (link) {
      const h = href(link[2], site);
      return h ? `<a href="${esc(h)}" style="color:${linkColor};text-decoration:underline;">${esc(link[1])}</a>` : esc(link[1]);
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
