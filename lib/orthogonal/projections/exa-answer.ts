import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  query: z.string().min(1).describe("Question to answer"),
  text: z.boolean().optional().describe("Include full text of cited sources (default false)"),
  stream: z.boolean().optional().describe("Stream the answer (default false; should be false for tool calls)"),
});

export type Input = z.infer<typeof inputSchema>;

const citationItem = z.object({
  title: z.string().nullable(),
  url: z.string().nullable(),
  published_date: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("exa /answer"),
  summary: z.object({
    answer: z.string().nullable(),
    citation_count: z.number(),
    citations: z.array(citationItem).max(8),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { answer?: string; citations?: unknown[] };
  const citations = Array.isArray(r?.citations) ? r.citations : [];
  const trimmed = citations.slice(0, 8).map((item) => {
    const it = item as Record<string, unknown>;
    return {
      title: (it.title as string | undefined) ?? null,
      url: (it.url as string | undefined) ?? null,
      published_date: (it.publishedDate as string | undefined) ?? null,
    };
  });
  const rawAnswer = (r?.answer as string | undefined) ?? null;
  const truncatedAnswer = rawAnswer && rawAnswer.length > 800 ? rawAnswer.slice(0, 800) + "..." : rawAnswer;
  return {
    result_id,
    endpoint: "exa /answer",
    summary: {
      answer: truncatedAnswer ? wrapUntrusted(truncatedAnswer, "exa.answer") : null,
      citation_count: citations.length,
      citations: trimmed,
    },
    available_paths: [
      "$.citations[*].highlights",
      "$.citations[*].image",
      "$.citations[*].publishedDate",
      "$.requestId",
    ],
    price_usd,
  };
}
