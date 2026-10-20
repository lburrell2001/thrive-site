// A deliberately small markdown subset for proposal prose.
//
// Block bodies are written by Lauren in the builder, not by clients, but the
// output still goes to a public URL — so this builds React elements rather
// than HTML strings. There is no dangerouslySetInnerHTML anywhere in the
// proposal renderer, which makes injection structurally impossible.
//
// Supported: paragraphs, - bullet lists, ### subheadings, > callouts,
// **bold**, *italic*, [text](url).
import { Fragment, type ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

/** Only these schemes are allowed to become an href. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:|mailto:|\/)/i.test(trimmed) ? trimmed : null;
}

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((token, i) => {
    const key = `${keyPrefix}-${i}`;

    // Bold, italic and link text are rendered again, so a link inside bold
    // (**Send it [our way](/contact)**) or bold inside a link still works.
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>;
    }

    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={key}>{renderInline(token.slice(1, -1), key)}</em>;
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{renderInline(link[1], key)}</Fragment>;
      return (
        <a key={key} href={href} rel="noopener noreferrer">
          {renderInline(link[1], key)}
        </a>
      );
    }

    return <Fragment key={key}>{token}</Fragment>;
  });
}

/** Renders a markdown string into paragraphs and lists. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const chunks = (source ?? '').trim().split(/\n{2,}/).filter(Boolean);
  if (chunks.length === 0) return null;

  return (
    <div className={className}>
      {chunks.map((chunk, ci) => {
        const lines = chunk.split('\n');
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));

        // A ### line is a subheading; the proposal colours them in turn.
        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
          return <h3 key={ci}>{renderInline(lines[0].replace(/^#{1,3}\s+/, ''), String(ci))}</h3>;
        }

        // Lines starting with > are a callout: a bar down the left.
        if (lines.every((l) => /^\s*>/.test(l))) {
          const text = lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' ');
          // "**Revisions** Unlimited rounds…" — a bold label, then the point.
          const labelled = /^\*\*[^*]+\*\*\s*\S/.test(text);
          return (
            <blockquote key={ci} data-label={labelled || undefined}>
              {renderInline(text, String(ci))}
            </blockquote>
          );
        }

        if (isList) {
          return (
            <ul key={ci}>
              {lines.map((line, li) => (
                <li key={li}>{renderInline(line.replace(/^\s*[-*]\s+/, ''), `${ci}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        return <p key={ci}>{renderInline(chunk.replace(/\n/g, ' '), String(ci))}</p>;
      })}
    </div>
  );
}
