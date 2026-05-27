"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  text: string;
}

// Matches [src:tr_XXXXXXXX] anywhere in the text. The result_id pattern
// is "tr_" followed by 6-16 hex chars (see tool-result-store.ts
// mintResultId). Capture group is the bare result_id so the click handler
// can scroll to it.
const CITATION_RE = /\[src:(tr_[0-9a-f]{6,16})\]/g;

// Body text renders in Source Serif 4 at a calm reading size, matching
// the design's "reading material" aesthetic. The prose plugin still
// handles lists, code, blockquotes; we just override the typeface and
// trim the prose color scale to our ink ladder.
export function TextPart({ text }: Props) {
  const segments = useMemo(() => splitOnCitations(text), [text]);

  return (
    <div
      className="prose prose-sm max-w-none break-words font-serif text-[var(--ink-soft)]"
      style={{
        fontSize: 15,
        lineHeight: 1.65,
        textWrap: "pretty",
      }}
    >
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
  if (out.length === 0) out.push({ kind: "markdown", text });
  return out;
}

function CitationChip({ resultId }: { resultId: string }): ReactNode {
  return (
    <Fragment>
      <a
        href={`#${resultId}`}
        onClick={(e) => {
          // Smooth-scroll the source card into view and briefly highlight
          // it via the .citation-flash animation set on the tool card root.
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
        title={`Jump to source: ${resultId}`}
        className="mx-[2px] inline-flex h-[17px] min-w-[18px] items-center justify-center rounded-[4px] px-[5px] font-mono no-underline transition"
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          background: "var(--accent-soft)",
          color: "var(--accent-ink)",
          verticalAlign: "baseline",
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
        {resultId}
      </a>
    </Fragment>
  );
}
