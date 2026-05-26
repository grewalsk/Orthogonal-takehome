import { z } from "zod";

export const inputSchema = z.object({
  url_to_scrape: z.string().url().describe("URL to scrape"),
  formats: z.array(z.enum(["markdown", "html", "text", "json", "screenshot"])).optional(),
  wait_before_scraping: z.number().int().min(0).max(30000).optional().describe("ms to wait before capturing"),
  country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code for proxy"),
});

export type Input = z.infer<typeof inputSchema>;

export const projectionSchema = z.object({
  result_id: z.string(),
  endpoint: z.literal("olostep /v1/scrapes"),
  summary: z.object({
    url: z.string().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    scrape_id: z.string().nullable(),
    text_length: z.number().nullable(),
    markdown_length: z.number().nullable(),
    excerpt: z.string().nullable(),
  }),
  available_paths: z.array(z.string()),
  price_usd: z.number(),
});

export type Projection = z.infer<typeof projectionSchema>;

export function project(raw: unknown, result_id: string, price_usd: number): Projection {
  const r = raw as Record<string, unknown>;
  const result = (r?.result as Record<string, unknown> | undefined) ?? r;
  const metadata = (result?.page_metadata as Record<string, unknown> | undefined) ??
    (result?.metadata as Record<string, unknown> | undefined) ?? {};
  const text = (result?.text_content as string | undefined) ??
    (result?.text as string | undefined) ?? null;
  const md = (result?.markdown_content as string | undefined) ??
    (result?.markdown as string | undefined) ?? null;
  const excerpt = text
    ? text.replace(/\s+/g, " ").trim().slice(0, 300) + (text.length > 300 ? "..." : "")
    : null;
  return {
    result_id,
    endpoint: "olostep /v1/scrapes",
    summary: {
      url: (metadata.url as string | undefined) ??
        (result?.url_to_scrape as string | undefined) ??
        (r?.url as string | undefined) ?? null,
      title: (metadata.title as string | undefined) ?? null,
      status: (result?.status as string | undefined) ??
        (r?.status as string | undefined) ?? null,
      scrape_id: (r?.id as string | undefined) ??
        (result?.scrape_id as string | undefined) ?? null,
      text_length: text ? text.length : null,
      markdown_length: md ? md.length : null,
      excerpt,
    },
    available_paths: [
      "$.result.html_content",
      "$.result.markdown_content",
      "$.result.text_content",
      "$.result.json_content",
      "$.result.page_metadata",
      "$.result.links",
    ],
    price_usd,
  };
}
