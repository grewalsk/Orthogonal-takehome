import { z } from "zod";

export const inputSchema = z.object({
  q_keywords: z.string().optional().describe("Free-text search (e.g. 'sales hire 2024')"),
  person_titles: z.array(z.string()).optional().describe("Job titles to match (e.g. ['Account Executive', 'Sales Manager'])"),
  person_seniorities: z.array(z.string()).optional().describe("Seniority levels (e.g. ['senior', 'manager', 'director'])"),
  organization_names: z.array(z.string()).optional().describe("Company names to filter by"),
  organization_domains: z.array(z.string()).optional().describe("Company domains to filter by"),
  person_locations: z.array(z.string()).optional(),
  page: z.number().int().min(1).max(500).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(10).optional(),
});

export type Input = z.infer<typeof inputSchema>;

const personSummary = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  current_employer: z.string().nullable(),
  linkedin_url: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("apollo /api/v1/mixed_people/api_search"),
  summary: z.object({
    total_entries: z.number().nullable(),
    returned: z.number(),
    page: z.number().nullable(),
    people: z.array(personSummary).max(10),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { people?: unknown[]; pagination?: Record<string, unknown> };
  const peopleRaw = Array.isArray(r?.people) ? r.people : [];
  const pagination = r?.pagination ?? {};
  const top = peopleRaw.slice(0, 10).map((p) => {
    const person = p as Record<string, unknown>;
    const org = (person.organization as Record<string, unknown> | undefined) ?? {};
    return {
      name: (person.name as string | undefined) ?? null,
      title: (person.title as string | undefined) ?? null,
      current_employer: (org.name as string | undefined) ?? null,
      linkedin_url: (person.linkedin_url as string | undefined) ?? null,
    };
  });
  return {
    result_id,
    endpoint: "apollo /api/v1/mixed_people/api_search",
    summary: {
      total_entries: (pagination.total_entries as number | undefined) ?? null,
      returned: top.length,
      page: (pagination.page as number | undefined) ?? null,
      people: top,
    },
    available_paths: [
      "$.people[*].employment_history",
      "$.people[*].departments",
      "$.people[*].seniority",
      "$.pagination",
    ],
    price_usd,
  };
}
