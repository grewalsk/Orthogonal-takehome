"use client";

import { ExternalLink } from "lucide-react";

interface Result {
  title: string | null;
  url: string | null;
  snippet: string | null;
}

interface Props {
  summary: Record<string, unknown>;
}

export function SearchResultList({ summary }: Props) {
  const query = (summary.query as string | null) ?? null;
  const answer = (summary.answer as string | null) ?? null;
  const count = (summary.count as number | null) ?? 0;
  const results = (summary.results as Result[] | null) ?? [];

  return (
    <div className="space-y-2">
      {query && (
        <div className="text-[11px] text-zinc-500">
          query: <span className="font-mono">&ldquo;{query}&rdquo;</span> ({count} results)
        </div>
      )}
      {answer && <UntrustedBlock content={answer} />}
      <ol className="space-y-2">
        {results.slice(0, 10).map((r, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:underline dark:text-blue-300"
              >
                {r.title ?? r.url}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                {r.title ?? "untitled"}
              </span>
            )}
            {r.url && (
              <span className="text-[10px] text-zinc-500">{hostOf(r.url)}</span>
            )}
            {r.snippet && <UntrustedBlock content={r.snippet} dim />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function UntrustedBlock({ content, dim }: { content: string; dim?: boolean }) {
  // Strip the <untrusted_content ...> wrapper that the projection adds.
  // Reveal a small badge to indicate provenance.
  const inner = content
    .replace(/^<untrusted_content[^>]*>\s*/, "")
    .replace(/\s*<\/untrusted_content>\s*$/, "")
    .trim();
  return (
    <div
      className={
        "mt-0.5 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-[11px] " +
        (dim ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-800 dark:text-zinc-200") +
        " dark:bg-amber-950/40"
      }
    >
      <div className="mb-0.5 text-[9px] uppercase tracking-wide text-amber-800 dark:text-amber-300">
        untrusted
      </div>
      {inner}
    </div>
  );
}
