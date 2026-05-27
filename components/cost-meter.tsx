"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CostResponse {
  conversationId: string;
  llmCents: number;
  orthCents: number;
  totalCents: number;
  breakdown: {
    llm: {
      cents: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
    };
    orthogonal: {
      billedCents: number;
      wouldHaveBilledCents: number;
      savingsCents: number;
      toolCalls: number;
      cacheHits: number;
    };
  };
}

interface Props {
  conversationId: string;
  refreshKey: number;
}

// Inline cost meter, fits in the chat-client header next to the title.
// Opens an absolutely-positioned drawer below with the LLM + Orthogonal
// breakdown. The cache-savings highlight uses the accent palette instead
// of emerald to fit the paper aesthetic.
export function CostMeter({ conversationId, refreshKey }: Props) {
  const [data, setData] = useState<CostResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCost() {
      try {
        const res = await fetch(`/api/conversation/${conversationId}/cost`);
        if (!res.ok) return;
        const body = (await res.json()) as CostResponse;
        if (!cancelled) setData(body);
      } catch {
        // silent fail; meter is optional
      }
    }
    void fetchCost();
    return () => {
      cancelled = true;
    };
  }, [conversationId, refreshKey]);

  if (!data) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-[6px] rounded-md border border-[var(--rule)] bg-[var(--paper)] px-[10px] py-[6px] text-[12px] text-[var(--ink-soft)] transition hover:border-[var(--ink-faint)]"
      >
        <span className="font-mono font-medium">${(data.totalCents / 100).toFixed(2)}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">spent</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-[260px] rounded-md border border-[var(--rule)] bg-[var(--paper)] p-3 text-[11px] text-[var(--ink-soft)]"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <Row label="LLM" cents={data.llmCents}>
            <span className="text-[10px] text-[var(--ink-faint)]">
              {data.breakdown.llm.inputTokens.toLocaleString()} in / {data.breakdown.llm.outputTokens.toLocaleString()} out
            </span>
            {data.breakdown.llm.cacheReadTokens > 0 && (
              <div className="text-[10px] text-[var(--accent-ink)]">
                {data.breakdown.llm.cacheReadTokens.toLocaleString()} cached input tokens read
              </div>
            )}
          </Row>
          <div className="my-2 h-px bg-[var(--rule-soft)]" />
          <Row label="Orthogonal" cents={data.orthCents}>
            <span className="text-[10px] text-[var(--ink-faint)]">
              {data.breakdown.orthogonal.toolCalls} call{data.breakdown.orthogonal.toolCalls === 1 ? "" : "s"}
              {data.breakdown.orthogonal.cacheHits > 0 && ` (${data.breakdown.orthogonal.cacheHits} cache hit${data.breakdown.orthogonal.cacheHits === 1 ? "" : "s"})`}
            </span>
            {data.breakdown.orthogonal.savingsCents > 0 && (
              <div className="text-[10px] text-[var(--accent-ink)]">
                saved ${(data.breakdown.orthogonal.savingsCents / 100).toFixed(2)} via cache
              </div>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  cents,
  children,
}: {
  label: string;
  cents: number;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[var(--ink-muted)]">{label}</span>
        <span className="font-mono text-[var(--ink)]">${(cents / 100).toFixed(2)}</span>
      </div>
      {children}
    </div>
  );
}
