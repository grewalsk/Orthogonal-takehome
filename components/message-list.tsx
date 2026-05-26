"use client";

import type { UIMessage } from "ai";
import { TextPart } from "@/components/text-part";
import { ToolCallCard } from "@/components/tool-call-card";

interface Props {
  messages: UIMessage[];
}

export function MessageList({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="mt-12 text-center text-sm text-zinc-500">
        Ask a research question. The assistant has access to Apollo, Hunter, Tomba, LinkUp, and Olostep.
      </div>
    );
  }
  return (
    <ol className="space-y-6">
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}
    </ol>
  );
}

function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <li
      className={
        isUser
          ? "ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          : "mr-auto max-w-[95%] space-y-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      }
    >
      {(message.parts ?? []).map((p, i) => (
        <PartRouter key={i} part={p} isUser={isUser} />
      ))}
    </li>
  );
}

function PartRouter({ part, isUser }: { part: UIMessage["parts"][number]; isUser: boolean }) {
  if (part.type === "text") {
    if (isUser) {
      return <div className="whitespace-pre-wrap">{part.text}</div>;
    }
    return <TextPart text={part.text} />;
  }
  if (part.type === "reasoning") {
    return null;
  }
  if (part.type === "step-start") {
    return null;
  }
  if (part.type.startsWith("tool-")) {
    return <ToolCallCard part={part as unknown as Parameters<typeof ToolCallCard>[0]["part"]} />;
  }
  return null;
}
