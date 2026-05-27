"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Share2 } from "lucide-react";
import { MessageList } from "@/components/message-list";
import { CostMeter } from "@/components/cost-meter";
import { EvictionMarker } from "@/components/eviction-marker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Composer } from "@/components/composer";
import { EmptyState } from "@/components/empty-state";

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  evictedCount: number;
  memory: Record<string, unknown>;
}

export function ChatClient({ conversationId, initialMessages, evictedCount, memory }: Props) {
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
  const empty = messages.length === 0 && !busy;

  const title = useMemo(() => {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return null;
    const text = (firstUser.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => (p as { type?: string }).type === "text")
      .map((p) => p.text)
      .join(" ");
    return text.length > 70 ? text.slice(0, 69) + "…" : text;
  }, [messages]);

  function handleSubmit(text: string) {
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Top bar — sticky paper. Title comes from first user message,
          mode indicator shows the live router/streaming state. */}
      <header className="sticky top-0 z-10 flex items-center gap-[14px] border-b border-[var(--rule-soft)] bg-[var(--paper)] px-7 py-[14px]">
        {title ? (
          <>
            <div
              className="min-w-0 flex-1 truncate font-serif text-[15px] font-medium text-[var(--ink)]"
              style={{ letterSpacing: "-0.005em" }}
            >
              {title}
            </div>
            <span className="inline-flex items-center gap-[6px] font-mono text-[11px] text-[var(--ink-faint)]">
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{
                  background: busy ? "var(--accent)" : "var(--accent-ink)",
                  animation: busy ? "ortho-pulse 1.4s ease-in-out infinite" : "none",
                }}
              />
              {busy ? "researching" : "answer"} · {messages.length} turn{messages.length === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <div className="flex-1 font-mono text-[11px] text-[var(--ink-faint)]">
            conv {conversationId.slice(0, 8)}
          </div>
        )}
        <CostMeter conversationId={conversationId} refreshKey={costRefresh} />
        <button
          className="inline-flex items-center gap-[6px] rounded-md border border-[var(--rule)] bg-[var(--paper)] px-[10px] py-[6px] text-[12px] text-[var(--ink-soft)] transition hover:border-[var(--ink-faint)]"
          type="button"
          onClick={() => navigator.clipboard?.writeText(window.location.href)}
          title="Copy share link"
        >
          <Share2 className="h-[13px] w-[13px]" strokeWidth={1.4} />
          Share
        </button>
        <ThemeToggle />
      </header>

      {/* Body */}
      <main className="relative flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState
            onPick={handleSubmit}
            composer={<Composer onSubmit={handleSubmit} disabled={busy} size="lg" />}
          />
        ) : (
          <div className="mx-auto w-full max-w-[820px] px-10 pt-8 pb-16">
            {evictedCount > 0 && <EvictionMarker evictedCount={evictedCount} memory={memory} />}
            <MessageList messages={messages} />
            {error ? (
              <div className="mt-6 rounded-md border border-red-300 bg-red-50/70 px-4 py-3 text-sm text-red-900">
                {error.message}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Bottom composer, only when there is a conversation in progress */}
      {!empty && (
        <div
          className="sticky bottom-0 px-7 pb-[22px] pt-3"
          style={{ background: "linear-gradient(to top, var(--paper) 60%, transparent)" }}
        >
          <div className="mx-auto max-w-[820px]">
            <Composer onSubmit={handleSubmit} disabled={busy} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
