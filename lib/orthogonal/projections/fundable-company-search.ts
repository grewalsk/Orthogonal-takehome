import { z } from "zod";

export const inputSchema = z.object({
  name: z.string().optional().describe("Company name fuzzy match (e.g. 'Stripe')"),
  domain: z.string().optional().describe("Exact domain match (e.g. 'stripe.com')"),
  linkedin: z.string().optional().describe("LinkedIn URL"),
  crunchbase: z.string().optional().describe("Crunchbase URL"),
});

export type Input = z.infer<typeof inputSchema>;

const companyItem = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  short_description: z.string().nullable(),
  domain: z.string().nullable(),
  website: z.string().nullable(),
  linkedin: z.string().nullable(),
  crunchbase: z.string().nullable(),
  relevance_score: z.number().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("fundable /company/search"),
  summary: z.object({
    count: z.number(),
    companies: z.array(companyItem).max(8),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: { companies?: unknown[] } };
  const list = Array.isArray(r?.data?.companies) ? r!.data!.companies! : [];
  const trimmed = list.slice(0, 8).map((item) => {
    const it = item as Record<string, unknown>;
    const desc = (it.short_description as string | undefined) ?? null;
    return {
      id: (it.id as string | undefined) ?? null,
      name: (it.name as string | undefined) ?? null,
      short_description: desc && desc.length > 240 ? desc.slice(0, 240) + "..." : desc,
      domain: (it.domain as string | undefined) ?? null,
      website: (it.website as string | undefined) ?? null,
      linkedin: (it.linkedin as string | undefined) ?? null,
      crunchbase: (it.crunchbase as string | undefined) ?? null,
      relevance_score: typeof it.relevance_score === "number" ? it.relevance_score : null,
    };
  });
  return {
    result_id,
    endpoint: "fundable /company/search",
    summary: {
      count: list.length,
      companies: trimmed,
    },
    available_paths: [
      "$.data.companies[*]",
      "$.data.pagination",
    ],
    price_usd,
  };
}
