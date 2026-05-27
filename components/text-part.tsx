"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  text: string;
}

// Matches [src:tr_XXXXXXXX] anywhere in the text. The result_id pattern
// is "tr_" followed by 8 hex chars (see tool-result-store.ts mintResultId).
// Capture group is the bare result_id so the click handler can scroll to it.
const CITATION_RE = /\[src:(tr_[0-9a-f]{6,16})\]/g;

// react-markdown@10 uses processor.runSync internally, which is incompatible
// with @shikijs/rehype's async highlighter (would throw "runSync finished
// async. Use run instead" the moment a markdown message rendered). Dropped
// the shiki plugin; code blocks fall back to plain <code>/<pre> styled by
// the Tailwind typography plugin. Documented in README under "trade-offs".
export function TextPart({ text }: Props) {
  const segments = useMemo(() => splitOnCitations(text), [text]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
      {segments.map((seg, i) =>
        seg.kind === "markdown" ? (
          <ReactMarkdown key={i}>{seg.text}</ReactMarkdown>
        ) : (
          <CitationChip key={i} resultId={seg.resultId} />
        ),
      )}
    </div>
  );
}

type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "citation"; resultId: string };

function splitOnCitations(text: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  const re = new RegExp(CITATION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      out.push({ kind: "markdown", text: text.slice(cursor, match.index) });
    }
    out.push({ kind: "citation", resultId: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    out.push({ kind: "markdown", text: text.slice(cursor) });
  }
  if (out.length === 0) {
    out.push({ kind: "markdown", text });
  }
  return out;
}

function CitationChip({ resultId }: { resultId: string }): ReactNode {
  return (
    <Fragment>
      <a
        href={`#${resultId}`}
        onClick={(e) => {
          // Smooth-scroll the source card into view and briefly highlight
          // it via the :target CSS state set on the tool card root.
          e.preventDefault();
          const el = document.getElementById(resultId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            // Toggle a transient class so the highlight fires every click,
            // not just on the first hash navigation.
            el.classList.remove("citation-flash");
            void el.offsetWidth;
            el.classList.add("citation-flash");
          } else {
            window.location.hash = resultId;
          }
        }}
        className="mx-0.5 inline-flex items-center rounded bg-emerald-50 px-1 py-0.5 align-baseline font-mono text-[10px] font-medium text-emerald-700 no-underline ring-1 ring-emerald-200 transition hover:bg-emerald-100 hover:ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900 dark:hover:bg-emerald-950/60"
        title={`Jump to source: ${resultId}`}
      >
        {resultId}
      </a>
    </Fragment>
  );
}
