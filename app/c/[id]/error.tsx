"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("chat route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h1 className="text-lg font-semibold">Something broke loading this chat</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "Unknown error."}
        {error.digest ? (
          <span className="ml-1 font-mono text-[10px] text-zinc-500">({error.digest})</span>
        ) : null}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}
