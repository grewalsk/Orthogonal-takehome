import { z } from "zod";

export const inputSchema = z.object({
  domain: z.string().min(1).describe("Company domain (e.g. stripe.com)"),
});

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("hunter /v2/companies/find"),
  summary: z.object({
    name: z.string().nullable(),
    domain: z.string().nullable(),
    description: z.string().nullable(),
    industry: z.string().nullable(),
    employee_count: z.number().nullable(),
    founded_year: z.number().nullable(),
    headquarters: z.string().nullable(),
    linkedin_url: z.string().nullable(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: Record<string, unknown> };
  const d = r?.data ?? {};
  const metrics = (d.metrics as Record<string, unknown> | undefined) ?? {};
  const geo = (d.geo as Record<string, unknown> | undefined) ?? {};
  const city = (geo.city as string | undefined) ?? null;
  const state = (geo.state as string | undefined) ?? null;
  const country = (geo.country as string | undefined) ?? null;
  const hq = [city, state, country].filter(Boolean).join(", ") || null;
  const site = (d.site as Record<string, unknown> | undefined) ?? {};
  return {
    result_id,
    endpoint: "hunter /v2/companies/find",
    summary: {
      name: (d.name as string | undefined) ?? null,
      domain: (d.domain as string | undefined) ?? null,
      description: (d.description as string | undefined) ?? null,
      industry: (d.industry as string | undefined) ?? (d.category as string | undefined) ?? null,
      employee_count: (metrics.employees as number | undefined) ?? null,
      founded_year: (d.founded_year as number | undefined) ?? (d.foundedYear as number | undefined) ?? null,
      headquarters: hq,
      linkedin_url: (site.linkedinHandle as string | undefined) ?? (d.linkedin as string | undefined) ?? null,
    },
    available_paths: [
      "$.data.tech[*]",
      "$.data.metrics",
      "$.data.site",
      "$.data.category",
      "$.data.description",
    ],
    price_usd,
  };
}
