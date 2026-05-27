import { z } from "zod";

export const inputSchema = z.object({
  page: z.string().optional().describe("Page number as a string (default '1')"),
  limit: z.string().optional().describe("Max results per page as a string (default '10', max '100')"),
  financing_types_normalized: z.string().optional().describe("Comma-separated financing rounds (e.g. 'series_a,series_b,seed')"),
  company_location: z.string().optional().describe("Filter by company HQ country (e.g. 'United States')"),
});

export type Input = z.infer<typeof inputSchema>;

const financingItem = z.object({
  id: z.string().nullable(),
  effective_date: z.string().nullable(),
  financing_type: z.string().nullable(),
  financing_type_normalized: z.string().nullable(),
  amount: z.string().nullable(),
  amount_normalized: z.number().nullable(),
  source_url: z.string().nullable(),
  company_id: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("predictleads /v3/discover/financing_events"),
  summary: z.object({
    count: z.number(),
    events: z.array(financingItem).max(10),
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
    const company = (rels.company as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    const sources = Array.isArray(attrs.source_urls) ? (attrs.source_urls as string[]) : [];
    return {
      id: (it.id as string | undefined) ?? null,
      effective_date: (attrs.effective_date as string | undefined) ?? null,
      financing_type: (attrs.financing_type as string | undefined) ?? null,
      financing_type_normalized: (attrs.financing_type_normalized as string | undefined) ?? null,
      amount: (attrs.amount as string | undefined) ?? null,
      amount_normalized: typeof attrs.amount_normalized === "number" ? (attrs.amount_normalized as number) : null,
      source_url: sources[0] ?? null,
      company_id: (company?.id as string | undefined) ?? null,
    };
  });
  return {
    result_id,
    endpoint: "predictleads /v3/discover/financing_events",
    summary: {
      count: list.length,
      events: trimmed,
    },
    available_paths: [
      "$.data[*].attributes.source_urls",
      "$.data[*].relationships.investors",
      "$.data[*].relationships.company",
      "$.included",
    ],
    price_usd,
  };
}
