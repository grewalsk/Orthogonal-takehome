import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  q: z.string().min(1).describe("Search query"),
  num: z.number().int().min(1).max(100).optional().describe("Results count (default 10)"),
  page: z.number().int().min(1).optional().describe("Page number (default 1)"),
  gl: z.string().optional().describe("Country code (e.g. 'us')"),
  hl: z.string().optional().describe("Language code (e.g. 'en')"),
  location: z.string().optional().describe("Location string (e.g. 'San Francisco, California')"),
  tbs: z.string().optional().describe("Time filter (e.g. 'qdr:w' for past week)"),
  autocorrect: z.boolean().optional(),
});

export type Input = z.infer<typeof inputSchema>;

const organicItem = z.object({
  title: z.string().nullable(),
  link: z.string().nullable(),
  snippet: z.string().nullable(),
  position: z.number().nullable(),
  date: z.string().nullable(),
});

const knowledgeGraph = z.object({
  title: z.string().nullable(),
  type: z.string().nullable(),
  description: z.string().nullable(),
  attribute_count: z.number(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("serper /search"),
  summary: z.object({
    query: z.string().nullable(),
    knowledge_graph: knowledgeGraph.nullable(),
    organic_count: z.number(),
    organic: z.array(organicItem).max(8),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as {
    searchParameters?: { q?: string };
    organic?: unknown[];
    knowledgeGraph?: Record<string, unknown>;
  };
  const list = Array.isArray(r?.organic) ? r.organic! : [];
  const trimmed = list.slice(0, 8).map((item) => {
    const it = item as Record<string, unknown>;
    const link = (it.link as string | undefined) ?? null;
    const snippet = (it.snippet as string | undefined) ?? null;
    return {
      title: (it.title as string | undefined) ?? null,
      link,
      snippet: snippet ? wrapUntrusted(snippet.slice(0, 240), "serper.search", link ?? undefined) : null,
      position: typeof it.position === "number" ? it.position : null,
      date: (it.date as string | undefined) ?? null,
    };
  });
  const kg = r?.knowledgeGraph;
  const kgProj: z.infer<typeof knowledgeGraph> | null = kg
    ? {
        title: (kg.title as string | undefined) ?? null,
        type: (kg.type as string | undefined) ?? null,
        description: (kg.description as string | undefined) ?? null,
        attribute_count:
          typeof kg.attributes === "object" && kg.attributes
            ? Object.keys(kg.attributes as Record<string, unknown>).length
            : 0,
      }
    : null;
  return {
    result_id,
    endpoint: "serper /search",
    summary: {
      query: (r?.searchParameters?.q as string | undefined) ?? null,
      knowledge_graph: kgProj,
      organic_count: list.length,
      organic: trimmed,
    },
    available_paths: [
      "$.organic[*]",
      "$.knowledgeGraph.attributes",
      "$.peopleAlsoAsk[*]",
      "$.relatedSearches[*]",
      "$.answerBox",
    ],
    price_usd,
  };
}
