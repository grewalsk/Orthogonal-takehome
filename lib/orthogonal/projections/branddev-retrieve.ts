import { z } from "zod";

export const inputSchema = z.object({
  domain: z.string().describe("Company domain (e.g. stripe.com)"),
  force_language: z.string().optional().describe("Override language detection (e.g. 'en')"),
  maxSpeed: z.boolean().optional().describe("Trade thoroughness for speed"),
  timeoutMS: z.number().int().optional().describe("Upstream timeout in milliseconds"),
});

export type Input = z.infer<typeof inputSchema>;

const colorItem = z.object({
  hex: z.string().nullable(),
  name: z.string().nullable(),
});

const logoItem = z.object({
  url: z.string().nullable(),
  mode: z.string().nullable(),
  type: z.string().nullable(),
});

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("brand-dev /v1/brand/retrieve"),
  summary: z.object({
    domain: z.string().nullable(),
    title: z.string().nullable(),
    slogan: z.string().nullable(),
    description: z.string().nullable(),
    primary_logo_url: z.string().nullable(),
    colors: z.array(colorItem).max(5),
    logos: z.array(logoItem).max(4),
    color_count: z.number(),
    logo_count: z.number(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as { brand?: Record<string, unknown> };
  const b = (r?.brand ?? {}) as Record<string, unknown>;
  const colors = Array.isArray(b.colors) ? (b.colors as Record<string, unknown>[]) : [];
  const logos = Array.isArray(b.logos) ? (b.logos as Record<string, unknown>[]) : [];
  const description = (b.description as string | undefined) ?? null;
  return {
    result_id,
    endpoint: "brand-dev /v1/brand/retrieve",
    summary: {
      domain: (b.domain as string | undefined) ?? null,
      title: (b.title as string | undefined) ?? null,
      slogan: (b.slogan as string | undefined) ?? null,
      description: description && description.length > 320 ? description.slice(0, 320) + "..." : description,
      primary_logo_url: (logos[0]?.url as string | undefined) ?? null,
      colors: colors.slice(0, 5).map((c) => ({
        hex: (c.hex as string | undefined) ?? null,
        name: (c.name as string | undefined) ?? null,
      })),
      logos: logos.slice(0, 4).map((l) => ({
        url: (l.url as string | undefined) ?? null,
        mode: (l.mode as string | undefined) ?? null,
        type: (l.type as string | undefined) ?? null,
      })),
      color_count: colors.length,
      logo_count: logos.length,
    },
    available_paths: [
      "$.brand.logos[*]",
      "$.brand.colors[*]",
      "$.brand.fonts",
      "$.brand.socials",
      "$.brand.industry",
    ],
    price_usd,
  };
}
