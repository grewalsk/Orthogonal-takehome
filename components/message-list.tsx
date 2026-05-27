"use client";

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

function AssistantMessage({ message }: { message: UIMessage }) {
  const parts = message.parts ?? [];
  const toolCount = parts.filter((p) => p.type.startsWith("tool-")).length;
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
      <div className="flex flex-col gap-3">
        {parts.map((p, i) => (
          <PartRouter key={i} part={p} />
        ))}
      </div>
    </div>
  );
}

function PartRouter({ part }: { part: UIMessage["parts"][number] }) {
  if (part.type === "text") {
    return <TextPart text={part.text} />;
  }
  if (part.type === "reasoning") return null;
  if (part.type === "step-start") return null;
  if (part.type.startsWith("tool-")) {
    return <ToolCallCard part={part as unknown as Parameters<typeof ToolCallCard>[0]["part"]} />;
  }
  return null;
}
