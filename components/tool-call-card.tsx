"use client";

import { useState } from "react";
import { Check, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { ContactCard } from "@/components/contact-card";
import { CompanyCard } from "@/components/company-card";
import { SearchResultList } from "@/components/search-result-list";

interface Props {
  part: ToolPart;
}

interface ToolPart {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

interface ProjectionShape {
  result_id?: string;
  endpoint?: string;
  summary?: Record<string, unknown>;
  available_paths?: string[];
  price_usd?: number;
}

// Tool calls render as a "thinking" disclosure — header always visible
// (status icon, tool name, input pill, price) and the whole summary +
// payload tucked behind a single click. This keeps the answer the
// primary visual unit; the audit trail is one click away.
export function ToolCallCard({ part }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fullPayload, setFullPayload] = useState<unknown>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const toolName = part.type.replace(/^tool-/, "");
  const state = part.state ?? "input-streaming";
  const output = part.output as ProjectionShape | undefined;
  const resultId = output?.result_id;
  const isStreaming = state !== "output-available" && state !== "output-error";

  async function loadPayload() {
    if (fullPayload || !resultId) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/tool-result/${resultId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setFullPayload(body);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !fullPayload) void loadPayload();
  }

  const inputPill = summarizeInput(part.input);
  const priceLabel = output?.price_usd !== undefined ? `$${output.price_usd.toFixed(2)}` : null;
  const headerInteractive = !isStreaming;

  return (
    <div
      id={resultId}
      className="scroll-mt-16 overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--paper-deep)] text-xs"
    >
      <button
        type="button"
        onClick={headerInteractive ? toggle : undefined}
        disabled={!headerInteractive}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
          headerInteractive ? "hover:bg-[var(--paper-edge)]" : "cursor-default"
        }`}
        aria-expanded={expanded}
      >
        <ChevronCaret expanded={expanded} streaming={isStreaming} />
        <StatusIcon state={state} />
        <span className="font-mono text-[var(--ink-soft)]">{toolName}</span>
        {inputPill && (
          <span className="rounded bg-[var(--paper)] px-[6px] py-[2px] font-mono text-[10px] text-[var(--ink-muted)]">
            {inputPill}
          </span>
        )}
        <div className="flex-1" />
        {priceLabel && (
          <span className="font-mono text-[10px] text-[var(--ink-faint)]">{priceLabel}</span>
        )}
      </button>

      {expanded && state === "output-available" && output?.summary && (
        <div className="border-t border-[var(--rule)] px-3 py-2">
          <SummaryBlock endpoint={output.endpoint} summary={output.summary} />
        </div>
      )}

      {state === "output-error" && part.errorText && (
        <div className="border-t border-[var(--rule)] px-3 py-2 text-[var(--warn)]">
          {part.errorText}
        </div>
      )}

      {expanded && resultId && (
        <div className="border-t border-[var(--rule)] px-3 py-[6px]">
          <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
            {fetching ? "loading full payload..." : "full payload"}
            <span className="ml-2 opacity-60">{resultId}</span>
          </div>
          {fetchError && (
            <div className="mt-1 text-[10px] text-[var(--warn)]">{fetchError}</div>
          )}
          {fullPayload !== null && (
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-[var(--paper)] p-2 font-mono text-[10px] text-[var(--ink-soft)]">
              {JSON.stringify(fullPayload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronCaret({ expanded, streaming }: { expanded: boolean; streaming: boolean }) {
  if (streaming) {
    return <span className="inline-block h-3 w-3" aria-hidden />;
  }
  return expanded ? (
    <ChevronDown className="h-3 w-3 flex-shrink-0 text-[var(--ink-faint)]" strokeWidth={1.6} />
  ) : (
    <ChevronRight className="h-3 w-3 flex-shrink-0 text-[var(--ink-faint)]" strokeWidth={1.6} />
  );
}

function StatusIcon({ state }: { state: string }) {
  if (state === "output-available") {
    return <Check className="h-[14px] w-[14px] text-[var(--accent-ink)]" strokeWidth={1.6} />;
  }
  if (state === "output-error") {
    return <AlertCircle className="h-[14px] w-[14px] text-[var(--warn)]" strokeWidth={1.6} />;
  }
  return <Loader2 className="h-[14px] w-[14px] animate-spin text-[var(--ink-muted)]" strokeWidth={1.6} />;
}

function summarizeInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return null;
  const rendered = entries
    .map(([k, v]) => {
      let str: string;
      if (typeof v === "string") str = v.length > 30 ? v.slice(0, 30) + "..." : v;
      else if (Array.isArray(v)) str = `[${v.length}]`;
      else if (typeof v === "object" && v !== null) str = "{...}";
      else str = String(v);
      return `${k}=${str}`;
    })
    .join(", ");
  return rendered.length > 80 ? rendered.slice(0, 80) + "..." : rendered;
}

function SummaryBlock({
  endpoint,
  summary,
}: {
  endpoint?: string;
  summary: Record<string, unknown>;
}) {
  if (endpoint === "apollo /api/v1/people/match") {
    return <ContactCard summary={summary} />;
  }
  if (
    endpoint === "apollo /api/v1/organizations/enrich" ||
    endpoint === "hunter /v2/companies/find"
  ) {
    return <CompanyCard summary={summary} />;
  }
  if (endpoint === "linkup /search") {
    return <SearchResultList summary={summary} />;
  }
  return <SummaryRows summary={summary} />;
}

function SummaryRows({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) {
    return <div className="italic text-[var(--ink-faint)]">no fields returned</div>;
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-[var(--ink-muted)]">{k}</dt>
          <dd className="break-words text-[var(--ink-soft)]">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return JSON.stringify(v).slice(0, 120);
}
