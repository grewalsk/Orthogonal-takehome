import { z } from "zod";

export const inputSchema = z.object({
  domain: z.string().min(1).describe("Company domain (e.g. stripe.com)"),
});

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("apollo /api/v1/organizations/enrich"),
  summary: z.object({
    name: z.string().nullable(),
    domain: z.string().nullable(),
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
  const r = raw as { organization?: Record<string, unknown> };
  const org = r?.organization ?? {};
  const city = (org.city as string | undefined) ?? null;
  const state = (org.state as string | undefined) ?? null;
  const country = (org.country as string | undefined) ?? null;
  const hq = [city, state, country].filter(Boolean).join(", ") || null;
  return {
    result_id,
    endpoint: "apollo /api/v1/organizations/enrich",
    summary: {
      name: (org.name as string | undefined) ?? null,
      domain: (org.primary_domain as string | undefined) ?? (org.website_url as string | undefined) ?? null,
      industry: (org.industry as string | undefined) ?? null,
      employee_count: (org.estimated_num_employees as number | undefined) ?? null,
      founded_year: (org.founded_year as number | undefined) ?? null,
      headquarters: hq,
      linkedin_url: (org.linkedin_url as string | undefined) ?? null,
    },
    available_paths: [
      "$.organization.funding_rounds[*]",
      "$.organization.technologies[*]",
      "$.organization.current_technologies[*]",
      "$.organization.keywords[*]",
      "$.organization.short_description",
    ],
    price_usd,
  };
}
