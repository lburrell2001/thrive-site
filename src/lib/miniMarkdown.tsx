// A deliberately small markdown subset for proposal prose.
//
// Block bodies are written by Lauren in the builder, not by clients, but the
// output still goes to a public URL — so this builds React elements rather
// than HTML strings. There is no dangerouslySetInnerHTML anywhere in the
// proposal renderer, which makes injection structurally impossible.
//
// Supported: paragraphs, - bullet lists, **bold**, *italic*, [text](url).
import { Fragment, type ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

/** Only these schemes are allowed to become an href. */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:|mailto:|\/)/i.test(trimmed) ? trimmed : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((token, i) => {
    const key = `${keyPrefix}-${i}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      return (
        <a key={key} href={href} rel="noopener noreferrer">
          {link[1]}
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
