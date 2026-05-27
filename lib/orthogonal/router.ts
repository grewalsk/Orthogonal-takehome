// Per-turn specialist tool router for the dynamic palette.
//
// The model always sees a fixed CORE tier (9 Orthogonal tools + 3 context
// tools) inside the Anthropic prompt cache anchor. The router picks K
// additional SPECIALIST endpoints from the catalog and adds them to the
// model's tool palette for this turn only.
//
// Implementation: a small Claude Haiku 4.5 call. The specialist list lives
// in a cached system block so only the user message changes per turn,
// keeping router input cost near-flat once the cache is warm.

import "@/lib/env";
import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { extractionModel } from "@/lib/llm";

export interface SpecialistEndpoint {
  slug: string;
  description: string;
  api: string;
}

export interface RouteToolsOptions {
  userMessage: string;
  specialists: SpecialistEndpoint[];
  k?: number;
  recentContext?: string;
}

export interface RouteToolsResult {
  selected: string[];
  reasoning: string;
  routerMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

const ResponseSchema = z.object({
  relevant_slugs: z.array(z.string()).max(15).describe("Slugs of the specialist endpoints relevant to the user's query"),
  reasoning: z.string().max(400).describe("Brief reason for the selection (1-2 sentences)"),
});

const MIN_MESSAGE_LENGTH = 3;

export async function routeTools(opts: RouteToolsOptions): Promise<RouteToolsResult> {
  const k = opts.k ?? 8;
  const empty = (reason: string): RouteToolsResult => ({
    selected: [],
    reasoning: reason,
    routerMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });

  if (opts.specialists.length === 0) {
    return empty("no specialists in pool");
  }
  if (opts.userMessage.trim().length < MIN_MESSAGE_LENGTH) {
    return empty("user message too short to route");
  }

  const specialistListText = opts.specialists
    .map((s) => `- ${s.slug} (${s.api}): ${s.description}`)
    .join("\n");

  const systemBlock = [
    "You are a tool router for a chat assistant.",
    `Given the user's most recent message, pick AT MOST ${k} specialist endpoints that are clearly relevant.`,
    "Prefer fewer high-quality matches. Empty list is a valid answer when nothing fits.",
    "Each specialist costs money to call, so do not include endpoints just in case.",
    "The assistant already has a CORE tier of tools (Apollo people/company, Hunter, Tomba, LinkUp search, Olostep scrape) always loaded; do NOT recommend specialists that duplicate the core tier.",
    "",
    "Specialist endpoints:",
    specialistListText,
  ].join("\n");

  const messages: ModelMessage[] = [
    {
      role: "system",
      content: systemBlock,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    {
      role: "user",
      content: opts.recentContext
        ? `Recent context:\n${opts.recentContext}\n\nLatest user message:\n${opts.userMessage}`
        : opts.userMessage,
    },
  ];

  const start = Date.now();
  let result;
  try {
    result = await generateObject({
      model: extractionModel,
      schema: ResponseSchema,
      messages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(JSON.stringify({ tag: "router.fail", error: msg }));
    return empty(`router error: ${msg.slice(0, 120)}`);
  }
  const routerMs = Date.now() - start;

  const validSlugSet = new Set(opts.specialists.map((s) => s.slug));
  const filtered = result.object.relevant_slugs.filter((slug) => validSlugSet.has(slug));

  const usage = result.usage;
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const cacheReadTokens =
    (usage as { inputTokenDetails?: { cacheReadTokens?: number } } | undefined)?.inputTokenDetails
      ?.cacheReadTokens ?? 0;
  const cacheWriteTokens =
    (usage as { inputTokenDetails?: { cacheWriteTokens?: number } } | undefined)?.inputTokenDetails
      ?.cacheWriteTokens ?? 0;

  console.log(
    JSON.stringify({
      tag: "router.ok",
      ms: routerMs,
      selectedCount: filtered.length,
      requestedCount: result.object.relevant_slugs.length,
      poolSize: opts.specialists.length,
      cacheReadTokens,
      cacheWriteTokens,
    }),
  );

  return {
    selected: filtered.slice(0, k),
    reasoning: result.object.reasoning,
    routerMs,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  };
}
