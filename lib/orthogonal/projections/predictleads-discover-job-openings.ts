import { z } from "zod";
import { wrapUntrusted } from "@/lib/orthogonal/safety";

// PredictLeads requires at least one of onet_codes or location. Documented in
// the description so the model knows to supply at least one filter.

export const inputSchema = z.object({
  onet_codes: z.string().optional().describe("Comma-separated O*NET occupation codes. Required if location is not supplied."),
  location: z.string().optional().describe("Location filter (city/region/country). Required if onet_codes is not supplied."),
  page: z.string().optional().describe("Page number as a string (default '1')"),
  limit: z.string().optional().describe("Max results per page as a string (default '10', max '100')"),
});

export type Input = z.infer<typeof inputSchema>;

const jobItem = z.object({
  id: z.string().nullable(),
  title: z.string().nullable(),
  location: z.string().nullable(),
  date_posted: z.string().nullable(),
  contract_types: z.string().nullable(),
  description: z.string().nullable(),
  source_url: z.string().nullable(),
  company_id: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("predictleads /v3/discover/job_openings"),
  summary: z.object({
    count: z.number(),
    jobs: z.array(jobItem).max(10),
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
    const descText = (attrs.description as string | undefined) ?? null;
    const contractTypes = Array.isArray(attrs.contract_types) ? (attrs.contract_types as string[]).join(", ") : null;
    return {
      id: (it.id as string | undefined) ?? null,
      title: (attrs.title as string | undefined) ?? null,
      location: (attrs.location as string | undefined) ?? null,
      date_posted: (attrs.first_seen_at as string | undefined) ?? (attrs.found_at as string | undefined) ?? null,
      contract_types: contractTypes,
      description: descText ? wrapUntrusted(descText.slice(0, 280), "predictleads.job_openings") : null,
      source_url: (attrs.url as string | undefined) ?? null,
      company_id: (company?.id as string | undefined) ?? null,
    };
  });
  return {
    result_id,
    endpoint: "predictleads /v3/discover/job_openings",
    summary: {
      count: list.length,
      jobs: trimmed,
    },
    available_paths: [
      "$.data[*].attributes.full_description",
      "$.data[*].attributes.onet_code",
      "$.data[*].relationships",
      "$.included",
    ],
    price_usd,
  };
}
