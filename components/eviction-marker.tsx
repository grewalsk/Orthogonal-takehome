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
        className="flex w-full items-center gap-2 border-y border-dashed border-zinc-300 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:hover:text-zinc-200"
      >
        <Archive className="h-3 w-3" />
        <span>
          {evictedCount} earlier message{evictedCount === 1 ? "" : "s"} compacted into {memoryKeys.length} memory key
          {memoryKeys.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1 rounded border border-dashed border-zinc-200 bg-zinc-50/60 p-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/50">
          {memoryKeys.length === 0 ? (
            <div className="italic text-zinc-500">no facts extracted yet</div>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
              {memoryKeys.map((k) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-zinc-500">{k}</dt>
                  <dd className="break-words text-zinc-700 dark:text-zinc-300">
                    {formatValue(memory[k])}
                  </dd>
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
