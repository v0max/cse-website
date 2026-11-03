/**
 * A deliberately tiny Markdown renderer for bios and short text fields.
 *
 * Supports what the content needs and nothing else (so nothing surprising
 * can end up on the page): paragraphs separated by blank lines,
 * *italic* or _italic_, **bold**, and [link text](https://...).
 */
import { Fragment, type ReactNode } from "react";

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function inline(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1] !== undefined) out.push(<strong key={key++}>{inline(m[1])}</strong>);
    else if (m[2] !== undefined || m[3] !== undefined) out.push(<em key={key++}>{inline(m[2] ?? m[3])}</em>);
    else if (m[4] !== undefined) {
      const href = m[5];
      const external = /^https?:\/\//.test(href);
      out.push(
        <a key={key++} href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
          {inline(m[4])}
        </a>,
      );
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : <Fragment>{out}</Fragment>;
}

export function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}
