import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

export const inputSchema = z.object({
  q: z.string().min(1).describe("Search query"),
  num: z.number().int().min(1).max(100).optional().describe("Results count (default 10)"),
  page: z.number().int().min(1).optional().describe("Page number (default 1)"),
  gl: z.string().optional().describe("Country code (e.g. 'us')"),
  hl: z.string().optional().describe("Language code (e.g. 'en')"),
  location: z.string().optional().describe("Location string (e.g. 'San Francisco, California')"),
  tbs: z.string().optional().describe("Time filter (e.g. 'qdr:w' for past week, 'qdr:d' for past day)"),
});

export type Input = z.infer<typeof inputSchema>;

const newsItem = z.object({
  title: z.string().nullable(),
  link: z.string().nullable(),
  snippet: z.string().nullable(),
  date: z.string().nullable(),
  source: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("serper /news"),
  summary: z.object({
    query: z.string().nullable(),
    count: z.number(),
    news: z.array(newsItem).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { news?: unknown[]; searchParameters?: { q?: string } };
  const list = Array.isArray(r?.news) ? r.news! : [];
  const trimmed = list.slice(0, 10).map((item) => {
    const it = item as Record<string, unknown>;
    const link = (it.link as string | undefined) ?? null;
    const snippet = (it.snippet as string | undefined) ?? null;
    return {
      title: (it.title as string | undefined) ?? null,
      link,
      snippet: snippet ? wrapUntrusted(snippet.slice(0, 240), "serper.news", link ?? undefined) : null,
      date: (it.date as string | undefined) ?? null,
      source: (it.source as string | undefined) ?? null,
    };
  });
  return {
    result_id,
    endpoint: "serper /news",
    summary: {
      query: (r?.searchParameters?.q as string | undefined) ?? null,
      count: list.length,
      news: trimmed,
    },
    available_paths: [
      "$.news[*].imageUrl",
      "$.searchParameters",
    ],
    price_usd,
  };
}
