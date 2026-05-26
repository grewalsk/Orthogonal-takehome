"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { MessageList } from "@/components/message-list";
import { CostMeter } from "@/components/cost-meter";
import { EvictionMarker } from "@/components/eviction-marker";
import { ThemeToggle } from "@/components/theme-toggle";

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  evictedCount: number;
  memory: Record<string, unknown>;
}

export function ChatClient({ conversationId, initialMessages, evictedCount, memory }: Props) {
  const [input, setInput] = useState("");
  const [costRefresh, setCostRefresh] = useState(0);
  const lastStatusRef = useRef<string | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    experimental_throttle: 100,
  });

  useEffect(() => {
    if (lastStatusRef.current === "streaming" && status === "ready") {
      setCostRefresh((n) => n + 1);
    }
    lastStatusRef.current = status;
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <CostMeter conversationId={conversationId} refreshKey={costRefresh} />

      <header className="flex items-center gap-3 border-b border-zinc-200 px-3 py-3 text-sm text-zinc-500 sm:px-4 dark:border-zinc-800">
        <div className="font-mono">conv {conversationId.slice(0, 8)}</div>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-6 sm:px-4">
        {evictedCount > 0 && <EvictionMarker evictedCount={evictedCount} memory={memory} />}
        <MessageList messages={messages} />
        {error ? (
          <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error.message}
          </div>
        ) : null}
      </main>

      <form onSubmit={submit} className="border-t border-zinc-200 px-3 py-3 sm:px-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "Working..." : "Ask anything..."}
            disabled={busy}
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
