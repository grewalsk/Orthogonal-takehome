import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  q: z.string().min(1).describe("Search query"),
  depth: z.enum(["standard", "deep"]).default("standard").optional(),
  outputType: z
    .enum(["searchResults", "sourcedAnswer", "structured"])
    .default("searchResults")
    .optional()
    .describe(
      "Default 'searchResults' (raw URLs + snippets, current dates visible). Use 'sourcedAnswer' ONLY when the user explicitly wants a narrative synthesis; it routes through LinkUp's own LLM which has its own training cutoff and frequently returns stale (e.g. months-old) summaries even when fresh sources exist.",
    ),
  includeImages: z.boolean().optional(),
});

export type Input = z.infer<typeof inputSchema>;

const resultItem = z.object({
  type: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  snippet: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("linkup /search"),
  summary: z.object({
    query: z.string().nullable(),
    output_type: z.string().nullable(),
    answer: z.string().nullable(),
    count: z.number(),
    results: z.array(resultItem).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { results?: unknown[]; sources?: unknown[]; answer?: string; output_type?: string; query?: string };
  const list = Array.isArray(r?.results) ? r.results : Array.isArray(r?.sources) ? r.sources : [];
  const trimmed = list.slice(0, 10).map((item) => {
    const it = item as Record<string, unknown>;
    const url = (it.url as string | undefined) ?? null;
    const rawSnippet = snippetOf((it.content as string | undefined) ?? (it.snippet as string | undefined) ?? null);
    return {
      type: (it.type as string | undefined) ?? null,
      title: (it.name as string | undefined) ?? (it.title as string | undefined) ?? null,
      url,
      snippet: rawSnippet ? wrapUntrusted(rawSnippet, "linkup.search", url ?? undefined) : null,
    };
  });
  const rawAnswer = (r?.answer as string | undefined) ?? null;
  return {
    result_id,
    endpoint: "linkup /search",
    summary: {
      query: (r?.query as string | undefined) ?? null,
      output_type: (r?.output_type as string | undefined) ?? null,
      answer: rawAnswer ? wrapUntrusted(rawAnswer, "linkup.search") : null,
      count: trimmed.length,
      results: trimmed,
    },
    available_paths: [
      "$.results[*].content",
      "$.sources[*]",
      "$.answer",
      "$.images[*]",
    ],
    price_usd,
  };
}

function snippetOf(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 240 ? cleaned.slice(0, 240) + "..." : cleaned;
}
