import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  task: z.string().min(1).describe("Plain-English description of what to find or research. The agent will search and browse web pages to answer."),
  json_format: z.object({}).passthrough().optional().describe("Optional JSON schema to structure the response"),
});

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("olostep /v1/answers"),
  summary: z.object({
    task: z.string().nullable(),
    status: z.string().nullable(),
    answer: z.string().nullable(),
    source_count: z.number(),
    source_urls: z.array(z.string()).max(8),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as Record<string, unknown>;
  const task = (r?.task as string | undefined) ?? null;
  const status = (r?.status as string | undefined) ?? null;
  const answerRaw = (r?.answer as string | undefined) ?? (r?.response as string | undefined) ?? null;
  const sources = Array.isArray(r?.sources) ? (r.sources as unknown[]) : Array.isArray(r?.source_urls) ? (r.source_urls as unknown[]) : [];
  const urls = sources
    .slice(0, 8)
    .map((s) => {
      if (typeof s === "string") return s;
      const obj = s as Record<string, unknown>;
      return (obj.url as string | undefined) ?? null;
    })
    .filter((u): u is string => u !== null);
  const truncatedAnswer = answerRaw && answerRaw.length > 800 ? answerRaw.slice(0, 800) + "..." : answerRaw;
  return {
    result_id,
    endpoint: "olostep /v1/answers",
    summary: {
      task,
      status,
      answer: truncatedAnswer ? wrapUntrusted(truncatedAnswer, "olostep.answers") : null,
      source_count: sources.length,
      source_urls: urls,
    },
    available_paths: [
      "$.sources[*]",
      "$.json_response",
      "$.steps[*]",
    ],
    price_usd,
  };
}
