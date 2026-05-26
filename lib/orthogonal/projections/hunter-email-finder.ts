import { z } from "zod";

export const inputSchema = z
  .object({
    domain: z.string().optional().describe("Company domain (e.g. stripe.com)"),
    company: z.string().optional().describe("Company name; use if domain unknown"),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
  })
  .refine(
    (v) => (v.domain || v.company) && (v.full_name || (v.first_name && v.last_name)),
    "Provide domain or company, plus full_name or (first_name + last_name).",
  );

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("hunter /v2/email-finder"),
  summary: z.object({
    email: z.string().nullable(),
    score: z.number().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    position: z.string().nullable(),
    domain: z.string().nullable(),
    verification_status: z.string().nullable(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: Record<string, unknown> };
  const d = r?.data ?? {};
  const verification = (d.verification as Record<string, unknown> | undefined) ?? {};
  return {
    result_id,
    endpoint: "hunter /v2/email-finder",
    summary: {
      email: (d.email as string | undefined) ?? null,
      score: (d.score as number | undefined) ?? null,
      first_name: (d.first_name as string | undefined) ?? null,
      last_name: (d.last_name as string | undefined) ?? null,
      position: (d.position as string | undefined) ?? null,
      domain: (d.domain as string | undefined) ?? null,
      verification_status: (verification.status as string | undefined) ?? null,
    },
    available_paths: [
      "$.data.sources[*]",
      "$.data.linkedin_url",
      "$.data.twitter",
      "$.data.phone_number",
    ],
    price_usd,
  };
}
