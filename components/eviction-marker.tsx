"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Archive } from "lucide-react";

interface Props {
  evictedCount: number;
  memory: Record<string, unknown>;
}

export function EvictionMarker({ evictedCount, memory }: Props) {
  const [open, setOpen] = useState(false);
  const memoryKeys = Object.keys(memory);

  return (
    <div className="my-4 select-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-y border-dashed border-[var(--rule)] py-[6px] font-mono text-[10.5px] uppercase tracking-[.05em] text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
      >
        <Archive className="h-3 w-3" strokeWidth={1.4} />
        <span>
          {evictedCount} earlier message{evictedCount === 1 ? "" : "s"} compacted into {memoryKeys.length} memory key
          {memoryKeys.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-dashed border-[var(--rule)] bg-[var(--paper-deep)] p-3 text-[11px]">
          {memoryKeys.length === 0 ? (
            <div className="italic text-[var(--ink-faint)]">no facts extracted yet</div>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              {memoryKeys.map((k) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-[var(--ink-muted)]">{k}</dt>
                  <dd className="break-words text-[var(--ink-soft)]">{formatValue(memory[k])}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 200);
}
