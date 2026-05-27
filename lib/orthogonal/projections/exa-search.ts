import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  query: z.string().min(1).describe("Natural-language search query"),
  numResults: z.number().int().min(1).max(25).optional().describe("Number of results to return (default 10)"),
  type: z.enum(["auto", "neural", "keyword"]).optional().describe("Search algorithm (default auto)"),
  includeDomains: z.array(z.string()).optional().describe("Restrict to these domains"),
  excludeDomains: z.array(z.string()).optional().describe("Exclude these domains"),
  startPublishedDate: z.string().optional().describe("ISO 8601 start date for published date filter"),
  endPublishedDate: z.string().optional().describe("ISO 8601 end date for published date filter"),
});

export type Input = z.infer<typeof inputSchema>;

const resultItem = z.object({
  title: z.string().nullable(),
  url: z.string().nullable(),
  published_date: z.string().nullable(),
  score: z.number().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("exa /search"),
  summary: z.object({
    query: z.string().nullable(),
    type: z.string().nullable(),
    count: z.number(),
    results: z.array(resultItem).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { results?: unknown[]; resolvedSearchType?: string; searchType?: string };
  const list = Array.isArray(r?.results) ? r.results : [];
  const trimmed = list.slice(0, 10).map((item) => {
    const it = item as Record<string, unknown>;
    return {
      title: (it.title as string | undefined) ?? null,
      url: (it.url as string | undefined) ?? null,
      published_date: (it.publishedDate as string | undefined) ?? null,
      score: typeof it.score === "number" ? it.score : null,
    };
  });
  return {
    result_id,
    endpoint: "exa /search",
    summary: {
      query: null,
      type: (r?.resolvedSearchType as string | undefined) ?? (r?.searchType as string | undefined) ?? null,
      count: trimmed.length,
      results: trimmed,
    },
    available_paths: [
      "$.results[*].text",
      "$.results[*].summary",
      "$.results[*].highlights",
      "$.results[*].author",
      "$.requestId",
    ],
    price_usd,
  };
}

// wrapUntrusted is imported for parity with linkup-search; titles/urls from
// search results are not freeform attacker prose, so we do not wrap them at
// the projection level. Use read_tool_result + wrapUntrusted on $.results[*].text
// when the model wants the page body.
void wrapUntrusted;
