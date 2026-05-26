import { z } from "zod";

export const inputSchema = z.object({
  email: z.string().email().describe("Email address to verify"),
});

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("tomba /v1/email-verifier"),
  summary: z.object({
    email: z.string().nullable(),
    result: z.string().nullable(),
    status: z.string().nullable(),
    score: z.number().nullable(),
    smtp_provider: z.string().nullable(),
    disposable: z.boolean().nullable(),
    webmail: z.boolean().nullable(),
    accept_all: z.boolean().nullable(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { data?: { email?: Record<string, unknown> } };
  const e = r?.data?.email ?? {};
  return {
    result_id,
    endpoint: "tomba /v1/email-verifier",
    summary: {
      email: (e.email as string | undefined) ?? null,
      result: (e.result as string | undefined) ?? null,
      status: (e.status as string | undefined) ?? null,
      score: (e.score as number | undefined) ?? null,
      smtp_provider: (e.smtp_provider as string | undefined) ?? null,
      disposable: (e.disposable as boolean | undefined) ?? null,
      webmail: (e.webmail as boolean | undefined) ?? null,
      accept_all: (e.accept_all as boolean | undefined) ?? null,
    },
    available_paths: [
      "$.data.email.mx.records",
      "$.data.email.whois",
      "$.data.sources[*]",
      "$.data.email.smtp_check",
      "$.data.email.greylisted",
    ],
    price_usd,
  };
}
