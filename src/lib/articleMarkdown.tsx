// Markdown for journal articles: a superset of the proposal renderer.
//
// Same rule as miniMarkdown — build React elements, never HTML strings —
// so an article can link and embed images without any way to inject
// markup. Supported blocks:
//   ## Heading / ### Subheading    (get ids, for links to a section)
//   - bullets / 1. numbered lists
//   > quotes
//   ![alt text](https://… or /path)  on its own line
//   paragraphs, with **bold**, *italic*, [links](/services/brand-design)

import type { ReactNode } from 'react';
import { renderInline, safeHref } from '@/lib/miniMarkdown';

type Block =
  | { kind: 'h2' | 'h3'; text: string; id: string }
  | { kind: 'p' | 'quote'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'img'; alt: string; src: string };

export function headingId(text: string) {
  return text.toLowerCase().replace(/[*_`[\]()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function parseArticle(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) { flush(); continue; }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const text = heading[2].trim();
      blocks.push({ kind: heading[1].length === 2 ? 'h2' : 'h3', text, id: headingId(text) });
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (image) {
      flush();
      const src = safeHref(image[2]);
      if (src && !src.startsWith('mailto:')) blocks.push({ kind: 'img', alt: image[1], src });
      continue;
    }

    if (/^>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }

    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      flush();
      const pattern = bullet.test(line) ? bullet : numbered;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ''));
      i--;
      blocks.push({ kind: pattern === bullet ? 'ul' : 'ol', items });
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function Article({ source, className }: { source: string; className?: string }) {
  const blocks = parseArticle(source);
  const out: ReactNode[] = blocks.map((b, i) => {
    const key = `b${i}`;
    switch (b.kind) {
      case 'h2': return <h2 key={key} id={b.id}>{renderInline(b.text, key)}</h2>;
      case 'h3': return <h3 key={key} id={b.id}>{renderInline(b.text, key)}</h3>;
      case 'quote': return <blockquote key={key}><p>{renderInline(b.text, key)}</p></blockquote>;
      case 'ul': return <ul key={key}>{b.items.map((t, j) => <li key={j}>{renderInline(t, `${key}-${j}`)}</li>)}</ul>;
      case 'ol': return <ol key={key}>{b.items.map((t, j) => <li key={j}>{renderInline(t, `${key}-${j}`)}</li>)}</ol>;
      case 'img':
        return (
          <figure key={key}>
            {/* Article images are arbitrary URLs Lauren pastes; next/image would need each host allow-listed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.alt} loading="lazy" />
            {b.alt && <figcaption>{b.alt}</figcaption>}
          </figure>
        );
      default: return <p key={key}>{renderInline(b.text, key)}</p>;
    }
  });
  return <div className={className}>{out}</div>;
}

/** Plain text of an article, for word counts and the SEO checklist. */
export function articleText(source: string) {
  return parseArticle(source)
    .map((b) => ('text' in b ? b.text : 'items' in b ? b.items.join(' ') : b.alt))
    .join(' ')
    .replace(/\*\*|\*|\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function readingMinutes(source: string) {
  const words = articleText(source).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}
