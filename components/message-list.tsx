"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { UIMessage } from "ai";
import { TextPart } from "@/components/text-part";
import { ToolCallCard } from "@/components/tool-call-card";

interface Props {
  messages: UIMessage[];
}

export function MessageList({ messages }: Props) {
  if (messages.length === 0) return null;
  return (
    <ol className="m-0 list-none p-0">
      {messages.map((m) => (
        <li key={m.id} className="mb-10 last:mb-0">
          {m.role === "user" ? <UserMessage message={m} /> : <AssistantMessage message={m} />}
        </li>
      ))}
    </ol>
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  const text = (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => (p as { type?: string }).type === "text")
    .map((p) => p.text)
    .join("\n");
  return (
    <div className="mb-9 border-l-2 border-[var(--accent)] pl-4">
      <div className="mb-[6px] font-mono text-[10.5px] font-medium uppercase tracking-[.08em] text-[var(--ink-faint)]">
        You asked
      </div>
      <p
        className="m-0 font-serif text-[var(--ink)]"
        style={{
          fontSize: 22,
          lineHeight: 1.3,
          fontWeight: 400,
          letterSpacing: "-0.005em",
          textWrap: "balance",
        }}
      >
        {text}
      </p>
    </div>
  );
}

type Part = UIMessage["parts"][number];

function AssistantMessage({ message }: { message: UIMessage }) {
  const parts = (message.parts ?? []) as Part[];
  const lastToolIdx = findLastIndex(parts, (p) => p.type.startsWith("tool-"));
  const hasTools = lastToolIdx >= 0;

  // Everything up to and including the last tool call is the "thinking"
  // trace: tool cards plus the interleaved progress prose the model
  // writes between them. Everything after is the final answer that
  // stays visible by default.
  const thinkingParts: Part[] = hasTools ? parts.slice(0, lastToolIdx + 1) : [];
  const answerParts: Part[] = hasTools ? parts.slice(lastToolIdx + 1) : parts;
  const toolCount = thinkingParts.filter((p) => p.type.startsWith("tool-")).length;

  return (
    <div className="relative">
      <div className="mb-[18px] flex items-center gap-[10px] font-mono text-[12px] tracking-[.02em] text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: "var(--accent-ink)" }}
          />
          answer
        </span>
        {toolCount > 0 && (
          <>
            <span className="text-[var(--ink-faint)]">·</span>
            <span>
              {toolCount} tool call{toolCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>

      {hasTools && (
        <ThinkingDropdown toolCount={toolCount}>
          {thinkingParts.map((p, i) => (
            <PartRouter key={i} part={p} />
          ))}
        </ThinkingDropdown>
      )}

      {answerParts.length > 0 && (
        <div className="flex flex-col gap-3">
          {answerParts.map((p, i) => (
            <PartRouter key={i} part={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingDropdown({ toolCount, children }: { toolCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-[6px] rounded-md border border-[var(--rule)] bg-[var(--paper-deep)] px-3 py-[6px] font-mono text-[11.5px] text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-[var(--ink-faint)]" strokeWidth={1.6} />
        ) : (
          <ChevronRight className="h-3 w-3 text-[var(--ink-faint)]" strokeWidth={1.6} />
        )}
        thinking
        <span className="text-[var(--ink-faint)]">·</span>
        <span>
          {toolCount} tool call{toolCount === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3 border-l border-[var(--rule)] pl-4">{children}</div>
      )}
    </div>
  );
}

function PartRouter({ part }: { part: Part }) {
  if (part.type === "text") {
    return <TextPart text={(part as { text: string }).text} />;
  }
  if (part.type === "reasoning") return null;
  if (part.type === "step-start") return null;
  if (part.type.startsWith("tool-")) {
    return <ToolCallCard part={part as unknown as Parameters<typeof ToolCallCard>[0]["part"]} />;
  }
  return null;
}

function findLastIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
