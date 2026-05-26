import { z } from "zod";

export const inputSchema = z.object({
  domain: z.string().min(1).describe("Domain to search (e.g. stripe.com)"),
  company: z.string().optional().describe("Optional company name to disambiguate"),
  type: z.enum(["personal", "generic"]).optional().describe("Filter to personal or generic email types"),
  department: z.string().optional().describe("Filter by department (e.g. sales, engineering)"),
  seniority: z.enum(["junior", "senior", "executive"]).optional(),
  limit: z.number().int().min(1).max(100).default(10).optional(),
});

export type Input = z.infer<typeof inputSchema>;

const emailSummary = z.object({
  value: z.string().nullable(),
  type: z.string().nullable(),
  confidence: z.number().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  position: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("hunter /v2/domain-search"),
  summary: z.object({
    domain: z.string().nullable(),
    organization: z.string().nullable(),
    pattern: z.string().nullable(),
    total_results: z.number().nullable(),
    emails: z.array(emailSummary).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: Record<string, unknown> };
  const d = r?.data ?? {};
  const emailsRaw = Array.isArray(d.emails) ? (d.emails as Array<Record<string, unknown>>) : [];
  const meta = (d.meta as Record<string, unknown> | undefined) ?? {};
  const emails = emailsRaw.slice(0, 10).map((e) => ({
    value: (e.value as string | undefined) ?? null,
    type: (e.type as string | undefined) ?? null,
    confidence: (e.confidence as number | undefined) ?? null,
    first_name: (e.first_name as string | undefined) ?? null,
    last_name: (e.last_name as string | undefined) ?? null,
    position: (e.position as string | undefined) ?? null,
  }));
  return {
    result_id,
    endpoint: "hunter /v2/domain-search",
    summary: {
      domain: (d.domain as string | undefined) ?? null,
      organization: (d.organization as string | undefined) ?? null,
      pattern: (d.pattern as string | undefined) ?? null,
      total_results: (meta.results as number | undefined) ?? emailsRaw.length,
      emails,
    },
    available_paths: [
      "$.data.emails[*].sources",
      "$.data.emails[*].verification",
      "$.data.emails[*].seniority",
      "$.data.emails[*].department",
    ],
    price_usd,
  };
}
