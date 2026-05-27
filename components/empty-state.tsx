"use client";

import type { ReactNode } from "react";

interface Props {
  onPick: (text: string) => void;
  composer: ReactNode;
}

const SUGGESTIONS: Array<{ tag: string; text: string }> = [
  {
    tag: "Research",
    text: "Research Stripe: give me company info, the CEO's email, and the top 5 sales hires from the last year.",
  },
  {
    tag: "Find",
    text: "Find recent venture financing events for AI infrastructure startups in the US.",
  },
  {
    tag: "Verify",
    text: "Verify whether support@vercel.com is a deliverable address and find the tech stack of vercel.com.",
  },
  {
    tag: "Discover",
    text: "What technology does shopify.com use, and what brand colors do they ship with?",
  },
];

export function EmptyState({ onPick, composer }: Props) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pt-[11vh] pb-[6vh]">
      <div className="text-center">
        <div
          className="font-serif text-[var(--ink)]"
          style={{
            fontSize: "clamp(34px, 4.4vw, 52px)",
            fontWeight: 400,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            textWrap: "balance",
          }}
        >
          Research, in{" "}
          <em className="italic text-[var(--accent-ink)]" style={{ fontStyle: "italic" }}>
            plain
          </em>{" "}
          language.
        </div>
        <div
          className="mx-auto mt-[14px] text-[var(--ink-muted)]"
          style={{ fontSize: "15.5px", textWrap: "pretty", maxWidth: 540 }}
        >
          Orthogonal calls real APIs across the web, enriches the result with typed projections,
          and answers with citations one click from the source.
        </div>
      </div>

      <div className="mt-9">{composer}</div>

      <div className="mt-[22px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.text)}
            className="group flex flex-col gap-[6px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] px-4 py-[14px] text-left transition hover:border-[var(--ink-faint)] hover:bg-[oklch(0.985_0.008_85)]"
          >
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[.04em] text-[var(--accent-ink)]">
              {s.tag}
            </span>
            <span className="text-[13.5px] leading-[1.5] text-[var(--ink-soft)]">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
