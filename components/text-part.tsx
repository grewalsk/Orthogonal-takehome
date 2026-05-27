"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Props {
  text: string;
}

// Matches [src:tr_XXXXXXXX] anywhere in the text. The result_id pattern
// is "tr_" followed by 6-16 hex chars (see tool-result-store.ts
// mintResultId).
const CITATION_RE = /\[src:(tr_[0-9a-f]{6,16})\]/g;

// Body text renders in Source Serif 4 at a calm reading size. We feed
// remark-gfm for tables/strikethrough/task-lists/autolinks, and
// rehype-raw so inline HTML survives parsing — we use that to inject
// <sup data-tr="tr_X">N</sup> placeholders in place of the raw
// [src:tr_X] markers BEFORE rendering, then the components.sup override
// renders our CitationChip in the right place. This way citations
// render correctly inside table cells, blockquotes, list items, etc.
//
// Each unique tr_id gets a sequential number per message (1, 2, 3...).
// Same source cited multiple times reuses the same number.
export function TextPart({ text }: Props) {
  const { preprocessed, idForN } = useMemo(() => buildPreprocessed(text), [text]);

  const components: Components = useMemo(
    () => ({
      sup({ children, ...props }) {
        // rehype-raw passes HTML attrs through as data-* lowercase. The
        // SUP we injected carries data-tr; default <sup> tags from the
        // model render through as-is.
        const dataTr = (props as { "data-tr"?: string })["data-tr"];
        if (typeof dataTr === "string" && dataTr.startsWith("tr_")) {
          const n = parseInt(String(children).replace(/\D/g, ""), 10) || 0;
          return <CitationChip resultId={dataTr} n={n} />;
        }
        return <sup {...props}>{children}</sup>;
      },
    }),
    [],
  );

  // The void void var is just to silence the "unused" lint for the map
  // that the components closure reads via its captured scope.
  void idForN;

  return (
    <div
      className="prose prose-sm max-w-none break-words font-serif text-[var(--ink-soft)]
        prose-headings:font-serif prose-headings:text-[var(--ink)] prose-headings:font-medium
        prose-strong:text-[var(--ink)] prose-strong:font-medium
        prose-a:text-[var(--accent-ink)] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
        prose-table:border-collapse prose-th:border prose-th:border-[var(--rule)] prose-th:bg-[var(--paper-deep)] prose-th:p-2 prose-th:text-left prose-th:font-mono prose-th:text-[11px] prose-th:font-medium prose-th:text-[var(--ink-muted)] prose-th:uppercase prose-th:tracking-[.04em]
        prose-td:border prose-td:border-[var(--rule)] prose-td:p-2 prose-td:align-top prose-td:text-[14px]
        prose-code:rounded prose-code:bg-[var(--paper-deep)] prose-code:px-1 prose-code:py-px prose-code:font-mono prose-code:text-[12px] prose-code:text-[var(--ink)] prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[var(--paper-deep)] prose-pre:text-[var(--ink-soft)] prose-pre:border prose-pre:border-[var(--rule)]
        prose-li:my-[2px]
        prose-blockquote:border-l-[3px] prose-blockquote:border-[var(--accent)] prose-blockquote:not-italic prose-blockquote:text-[var(--ink-soft)]"
      style={{
        fontSize: 15,
        lineHeight: 1.65,
        textWrap: "pretty",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {preprocessed}
      </ReactMarkdown>
    </div>
  );
}

function buildPreprocessed(text: string): { preprocessed: string; idForN: Map<number, string> } {
  const order: string[] = [];
  const idToN = new Map<string, number>();
  const replaced = text.replace(CITATION_RE, (_match, id: string) => {
    if (!idToN.has(id)) {
      order.push(id);
      idToN.set(id, order.length);
    }
    return `<sup data-tr="${id}">${idToN.get(id)}</sup>`;
  });
  const idForN = new Map<number, string>();
  order.forEach((id, i) => idForN.set(i + 1, id));
  return { preprocessed: replaced, idForN };
}

function CitationChip({ resultId, n }: { resultId: string; n: number }): ReactNode {
  return (
    <a
      href={`#${resultId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(resultId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.remove("citation-flash");
          void el.offsetWidth;
          el.classList.add("citation-flash");
        } else {
          window.location.hash = resultId;
        }
      }}
      title={`Source: ${resultId}`}
      className="ml-[1px] inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-[3px] px-[3px] font-mono no-underline transition"
      style={{
        fontSize: 9.5,
        fontWeight: 500,
        background: "var(--accent-soft)",
        color: "var(--accent-ink)",
        verticalAlign: "baseline",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--accent)";
        e.currentTarget.style.color = "var(--paper)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--accent-soft)";
        e.currentTarget.style.color = "var(--accent-ink)";
      }}
    >
      {n}
    </a>
  );
}
