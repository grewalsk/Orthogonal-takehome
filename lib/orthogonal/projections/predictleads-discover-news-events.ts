import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

// PredictLeads query-param scalars must be sent as strings even when the
// /v1/details schema labels them integer. The upstream API rejects numeric
// values with "Expected string, received number". Inputs below use z.string()
// for limit/page/etc, and the model is instructed accordingly via .describe().

export const inputSchema = z.object({
  page: z.string().optional().describe("Page number as a string (default '1')"),
  limit: z.string().optional().describe("Max results per page as a string (default '10', max '100')"),
  categories: z.string().optional().describe("Comma-separated news event categories (e.g. 'launches,recognition,partnership')"),
  company_location: z.string().optional().describe("Filter by company HQ country (e.g. 'United States')"),
});

export type Input = z.infer<typeof inputSchema>;

const newsItem = z.object({
  id: z.string().nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  article_sentence: z.string().nullable(),
  effective_date: z.string().nullable(),
  location: z.string().nullable(),
  product: z.string().nullable(),
  amount_normalized: z.number().nullable(),
  company_id: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("predictleads /v3/discover/news_events"),
  summary: z.object({
    count: z.number(),
    events: z.array(newsItem).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: unknown[] };
  const list = Array.isArray(r?.data) ? r.data! : [];
  const trimmed = list.slice(0, 10).map((item) => {
    const it = item as Record<string, unknown>;
    const attrs = (it.attributes ?? {}) as Record<string, unknown>;
    const rels = (it.relationships ?? {}) as Record<string, unknown>;
    const company1 = (rels.company1 as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    const summaryText = (attrs.summary as string | undefined) ?? null;
    const sentenceText = (attrs.article_sentence as string | undefined) ?? null;
    return {
      id: (it.id as string | undefined) ?? null,
      category: (attrs.category as string | undefined) ?? null,
      summary: summaryText ? wrapUntrusted(summaryText.slice(0, 300), "predictleads.news_events") : null,
      article_sentence: sentenceText ? wrapUntrusted(sentenceText.slice(0, 300), "predictleads.news_events") : null,
      effective_date: (attrs.effective_date as string | undefined) ?? null,
      location: (attrs.location as string | undefined) ?? null,
      product: (attrs.product as string | undefined) ?? null,
      amount_normalized: typeof attrs.amount_normalized === "number" ? (attrs.amount_normalized as number) : null,
      company_id: (company1?.id as string | undefined) ?? null,
    };
  });
  return {
    result_id,
    endpoint: "predictleads /v3/discover/news_events",
    summary: {
      count: list.length,
      events: trimmed,
    },
    available_paths: [
      "$.data[*].attributes.location_data",
      "$.data[*].attributes.product_data",
      "$.data[*].relationships",
      "$.included",
    ],
    price_usd,
  };
}
