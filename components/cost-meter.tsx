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
    <div className="fixed right-3 top-3 z-20 select-none rounded-lg border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-zinc-700 dark:text-zinc-300"
      >
        <span className="font-semibold">${(data.totalCents / 100).toFixed(2)}</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">spent</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <Row label="LLM" cents={data.llmCents}>
            <span className="text-[10px] opacity-70">
              {data.breakdown.llm.inputTokens.toLocaleString()} in / {data.breakdown.llm.outputTokens.toLocaleString()} out
            </span>
            {data.breakdown.llm.cacheReadTokens > 0 && (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                {data.breakdown.llm.cacheReadTokens.toLocaleString()} cached input tokens read
              </div>
            )}
          </Row>
          <Row label="Orthogonal" cents={data.orthCents}>
            <span className="text-[10px] opacity-70">
              {data.breakdown.orthogonal.toolCalls} call{data.breakdown.orthogonal.toolCalls === 1 ? "" : "s"}
              {data.breakdown.orthogonal.cacheHits > 0 && ` (${data.breakdown.orthogonal.cacheHits} cache hit${data.breakdown.orthogonal.cacheHits === 1 ? "" : "s"})`}
            </span>
            {data.breakdown.orthogonal.savingsCents > 0 && (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
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
        <span>{label}</span>
        <span className="font-mono">${(cents / 100).toFixed(2)}</span>
      </div>
      {children}
    </div>
  );
}
