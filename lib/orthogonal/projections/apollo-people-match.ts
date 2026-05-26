import { z } from "zod";

export const inputSchema = z
  .object({
    email: z.string().email().optional().describe("Person's email if known"),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    organization_name: z.string().optional(),
    linkedin_url: z.string().url().optional(),
    domain: z.string().optional().describe("Company domain (e.g. stripe.com)"),
  })
  .refine(
    (v) =>
      Boolean(v.email) ||
      Boolean(v.linkedin_url) ||
      Boolean(v.first_name && v.last_name && (v.organization_name || v.domain)),
    "Provide one of: email, linkedin_url, or (first_name + last_name + organization_name|domain).",
  );

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("apollo /api/v1/people/match"),
  summary: z.object({
    name: z.string().nullable(),
    title: z.string().nullable(),
    email: z.string().nullable(),
    current_employer: z.string().nullable(),
    linkedin_url: z.string().nullable(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { person?: Record<string, unknown> };
  const p = r?.person ?? {};
  const org = (p.organization as Record<string, unknown> | undefined) ?? {};
  return {
    result_id,
    endpoint: "apollo /api/v1/people/match",
    summary: {
      name: (p.name as string | undefined) ?? null,
      title: (p.title as string | undefined) ?? null,
      email: (p.email as string | undefined) ?? null,
      current_employer: (org.name as string | undefined) ?? null,
      linkedin_url: (p.linkedin_url as string | undefined) ?? null,
    },
    available_paths: [
      "$.person.employment_history[*]",
      "$.person.phone_numbers[*]",
      "$.person.organization",
      "$.person.departments[*]",
      "$.person.seniority",
    ],
    price_usd,
  };
}
