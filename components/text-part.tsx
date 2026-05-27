"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  text: string;
}

// Matches [src:tr_XXXXXXXX] anywhere in the text. The result_id pattern
// is "tr_" followed by 6-16 hex chars (see tool-result-store.ts
// mintResultId). Capture group is the bare result_id so the click
// handler can scroll to it.
const CITATION_RE = /\[src:(tr_[0-9a-f]{6,16})\]/g;

// Body text renders in Source Serif 4 at a calm reading size, matching
// the design's "reading material" aesthetic. We feed remark-gfm so
// tables, strikethrough, task lists, and autolinks render properly
// (without it, GitHub-style tables stay as literal pipes).
//
// Citations: we scan the whole message text for unique tr_ ids and
// assign each a sequential number per message (1, 2, 3...). The visible
// chip is just that tiny superscript number; the actual tr_ id stays as
// the scroll target on click.
export function TextPart({ text }: Props) {
  const { segments, citationNumberById } = useMemo(() => buildSegments(text), [text]);

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
      {segments.map((seg, i) =>
        seg.kind === "markdown" ? (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {seg.text}
          </ReactMarkdown>
        ) : (
          <CitationChip
            key={i}
            resultId={seg.resultId}
            n={citationNumberById.get(seg.resultId) ?? 0}
          />
        ),
      )}
    </div>
  );
}

type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "citation"; resultId: string };

function buildSegments(text: string): { segments: Segment[]; citationNumberById: Map<string, number> } {
  const segments: Segment[] = [];
  const order: string[] = [];
  let cursor = 0;
  const re = new RegExp(CITATION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: "markdown", text: text.slice(cursor, match.index) });
    }
    segments.push({ kind: "citation", resultId: match[1] });
    if (!order.includes(match[1])) order.push(match[1]);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "markdown", text: text.slice(cursor) });
  }
  if (segments.length === 0) {
    segments.push({ kind: "markdown", text });
  }
  const citationNumberById = new Map<string, number>();
  order.forEach((id, i) => citationNumberById.set(id, i + 1));
  return { segments, citationNumberById };
}

function CitationChip({ resultId, n }: { resultId: string; n: number }): ReactNode {
  return (
    <Fragment>
      <sup>
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
      </sup>
    </Fragment>
  );
}
