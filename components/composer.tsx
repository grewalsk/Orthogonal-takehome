"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  size?: "lg" | "sm";
  placeholderLg?: string;
  placeholderSm?: string;
}

// Paper-card composer adopted from the Orthogonal design bundle. Two
// sizes: lg for the empty state, sm for the bottom-anchored composer
// during an active conversation. Textarea auto-grows up to 220px.
export function Composer({
  onSubmit,
  disabled = false,
  size = "lg",
  placeholderLg = "Ask anything. Orthogonal will call the right tools and answer with citations.",
  placeholderSm = "Ask a follow-up...",
}: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  function submit(e?: FormEvent | KeyboardEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  }

  const isLg = size === "lg";
  const canSend = !disabled && value.trim().length > 0;

  return (
    <form
      onSubmit={submit}
      className="rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] transition focus-within:border-[var(--ink-faint)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
        placeholder={isLg ? placeholderLg : placeholderSm}
        rows={isLg ? 2 : 1}
        disabled={disabled}
        className="block w-full resize-none border-0 bg-transparent font-sans text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] disabled:opacity-60"
        style={{
          padding: isLg ? "20px 22px 6px" : "14px 18px 4px",
          fontSize: isLg ? 16 : 14.5,
          lineHeight: 1.55,
          minHeight: isLg ? 60 : 32,
        }}
      />
      <div className="flex items-center gap-2 px-[14px] py-[10px] pl-[14px]">
        <div className="ml-auto flex items-center gap-[10px]">
          {isLg && (
            <span className="font-mono text-[11.5px] text-[var(--ink-faint)]">
              ⏎ to send · ⇧⏎ newline
            </span>
          )}
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-default"
            style={{
              background: canSend ? "var(--ink)" : "var(--paper-edge)",
              color: canSend ? "var(--paper)" : "var(--ink-faint)",
            }}
            aria-label="Send"
          >
            <ArrowUp className="h-[14px] w-[14px]" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </form>
  );
}
