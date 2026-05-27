// Tool palette factory for the dynamic-palette architecture.
//
// CORE_SLUGS is the always-loaded tier (hero-prompt coverage: Apollo
// people/company, Hunter, Tomba, LinkUp search, Olostep scrape). Those 9
// tool definitions live inside the Anthropic prompt cache anchor in
// build-model-messages.ts and survive every turn unchanged.
//
// All other curated endpoints are SPECIALIST tier. Each turn, the LLM
// router in lib/orthogonal/router.ts picks K specialists relevant to the
// user message; buildToolPalette merges them with the core tools and
// passes the result to streamText.
//
// Adding a new endpoint: append it to scripts/curated-endpoints.json, run
// `pnpm snapshot`, optionally hand-write a projection under
// lib/orthogonal/projections/<slug>.ts and add the import + PROJECTIONS
// entry below. Endpoints without a hand-tuned projection fall through to
// the generic projector in projections/generic.ts.

import { tool } from "ai";
import { z } from "zod";
import { callOrth, type ParamWrapper, ToolError } from "@/lib/orthogonal/client";
import { storeToolResult } from "@/lib/orthogonal/tool-result-store";
import { catalog, type CatalogEndpoint } from "@/lib/orthogonal/catalog.generated";
import { buildInputSchema, genericProject } from "@/lib/orthogonal/projections/generic";

// Sentinel string the UI scans for to render the credits-exhausted
// banner. The model also reads this in the tool-error text and treats
// it as a stop-calling-tools signal per the system prompt.
export const ORTH_CREDITS_EXHAUSTED_MARKER = "ORTH_CREDITS_EXHAUSTED";

import * as apollo_organizations_enrich from "@/lib/orthogonal/projections/apollo-organizations-enrich";
import * as apollo_people_match from "@/lib/orthogonal/projections/apollo-people-match";
import * as apollo_mixed_people_search from "@/lib/orthogonal/projections/apollo-mixed-people-search";
import * as hunter_domain_search from "@/lib/orthogonal/projections/hunter-domain-search";
import * as hunter_email_finder from "@/lib/orthogonal/projections/hunter-email-finder";
import * as hunter_companies_find from "@/lib/orthogonal/projections/hunter-companies-find";
import * as tomba_email_verifier from "@/lib/orthogonal/projections/tomba-email-verifier";
import * as linkup_search from "@/lib/orthogonal/projections/linkup-search";
import * as olostep_scrapes from "@/lib/orthogonal/projections/olostep-scrapes";

import * as branddev_retrieve from "@/lib/orthogonal/projections/branddev-retrieve";
import * as exa_search from "@/lib/orthogonal/projections/exa-search";
import * as exa_answer from "@/lib/orthogonal/projections/exa-answer";
import * as fundable_company_search from "@/lib/orthogonal/projections/fundable-company-search";
import * as olostep_answers from "@/lib/orthogonal/projections/olostep-answers";
import * as predictleads_discover_financing_events from "@/lib/orthogonal/projections/predictleads-discover-financing-events";
import * as predictleads_discover_job_openings from "@/lib/orthogonal/projections/predictleads-discover-job-openings";
import * as predictleads_discover_news_events from "@/lib/orthogonal/projections/predictleads-discover-news-events";
import * as serper_news from "@/lib/orthogonal/projections/serper-news";
import * as serper_search from "@/lib/orthogonal/projections/serper-search";

type ProjectFn<P = unknown> = (raw: unknown, result_id: string, price_usd: number) => P;

interface ProjectionModule {
  inputSchema: z.ZodTypeAny;
  project: ProjectFn;
}

const PROJECTIONS: Record<string, ProjectionModule> = {
  apollo_organizations_enrich,
  apollo_people_match,
  apollo_mixed_people_search,
  hunter_domain_search,
  hunter_email_finder,
  hunter_companies_find,
  tomba_email_verifier,
  linkup_search,
  olostep_scrapes,
  branddev_retrieve,
  exa_search,
  exa_answer,
  fundable_company_search,
  olostep_answers,
  predictleads_discover_financing_events,
  predictleads_discover_job_openings,
  predictleads_discover_news_events,
  serper_news,
  serper_search,
};

export const CORE_SLUGS = [
  "apollo_organizations_enrich",
  "apollo_people_match",
  "apollo_mixed_people_search",
  "hunter_domain_search",
  "hunter_email_finder",
  "hunter_companies_find",
  "tomba_email_verifier",
  "linkup_search",
  "olostep_scrapes",
] as const;

const CORE_SLUG_SET = new Set<string>(CORE_SLUGS);

export const SPECIALIST_SLUGS: string[] = catalog
  .map((e) => e.slug)
  .filter((slug) => !CORE_SLUG_SET.has(slug));

const ENDPOINT_BY_SLUG = new Map<string, CatalogEndpoint>(
  catalog.map((e) => [e.slug, e as CatalogEndpoint]),
);

function metaFor(slug: string): {
  api: string;
  path: string;
  paramWrapper: ParamWrapper;
  priceCents: number;
  description: string;
} {
  const e = ENDPOINT_BY_SLUG.get(slug);
  if (!e) throw new Error(`Catalog missing slug: ${slug}`);
  const paramWrapper: ParamWrapper = e.method === "GET" ? "query" : "body";
  return {
    api: e.api,
    path: e.path,
    paramWrapper,
    priceCents: e.priceCents,
    description: e.description,
  };
}

function describe(slug: string): string {
  const m = metaFor(slug);
  const price = m.priceCents > 0 ? `$${(m.priceCents / 100).toFixed(2)}` : "free";
  return `${m.description} Costs ${price} per call. Returns a typed projection: summary + available_paths. Use read_tool_result(tr_X, "$.path") for drill-in.`;
}

async function executeTool<InputType, ProjectionType>(
  slug: string,
  input: InputType,
  project: ProjectFn<ProjectionType>,
): Promise<ProjectionType> {
  const m = metaFor(slug);
  let result;
  try {
    result = await callOrth({
      endpointSlug: slug,
      api: m.api,
      path: m.path,
      paramWrapper: m.paramWrapper,
      params: input as Record<string, unknown>,
    });
  } catch (err) {
    // Surface credits-exhausted with a marker the UI and model both
    // detect. The model is instructed in the system prompt to stop
    // calling tools when it sees this; the UI renders a prominent
    // top-up callout instead of the generic red error blob.
    if (err instanceof ToolError && err.code === "INSUFFICIENT_CREDITS") {
      throw new Error(
        `${ORTH_CREDITS_EXHAUSTED_MARKER}: The Orthogonal API key has run out of credits. ` +
          `All further tool calls will fail until the key is topped up at https://orthogonal.com. ` +
          `STOP calling tools and tell the user to top up before trying again.`,
      );
    }
    throw err;
  }
  const result_id = await storeToolResult({
    slug,
    api: m.api,
    path: m.path,
    input,
    output: result.data,
    priceCents: result.priceCents,
    upstreamRequestId: result.upstreamRequestId,
    cacheHit: result.cacheHit,
  });
  return project(result.data, result_id, result.priceCents / 100);
}

function buildTool(slug: string): ReturnType<typeof tool> {
  const endpoint = ENDPOINT_BY_SLUG.get(slug);
  if (!endpoint) throw new Error(`Cannot build tool: catalog missing slug ${slug}`);
  const projection = PROJECTIONS[slug];
  const inputSchema = projection?.inputSchema ?? buildInputSchema(endpoint);
  const project: ProjectFn = projection?.project ?? ((raw, id, price) => genericProject(raw, id, price, `${endpoint.api} ${endpoint.path}`));
  // tool() infers its input type from inputSchema. With ad-hoc Zod schemas
  // discovered at runtime, TS narrows to never and rejects the execute
  // callback. Erasing the schema type is the only escape; runtime behavior
  // (Zod validation in the SDK + execute receiving the parsed object) is
  // unchanged. Hand-tuned tools that want full inference can still be
  // constructed with the previous one-tool-per-slug pattern if needed.
  return tool({
    description: describe(slug),
    inputSchema: inputSchema as never,
    execute: ((input: unknown) => executeTool(slug, input as Record<string, unknown>, project)) as never,
  });
}

function buildAllForSlugs(slugs: readonly string[]): Record<string, ReturnType<typeof tool>> {
  const out: Record<string, ReturnType<typeof tool>> = {};
  for (const slug of slugs) {
    out[slug] = buildTool(slug);
  }
  return out;
}

export const coreTools: Record<string, ReturnType<typeof tool>> = buildAllForSlugs(CORE_SLUGS);

const SPECIALIST_TOOL_BY_SLUG: Record<string, ReturnType<typeof tool>> = buildAllForSlugs(SPECIALIST_SLUGS);

export function buildToolPalette(specialistSlugs: readonly string[]): Record<string, ReturnType<typeof tool>> {
  const specialists: Record<string, ReturnType<typeof tool>> = {};
  for (const slug of specialistSlugs) {
    const t = SPECIALIST_TOOL_BY_SLUG[slug];
    if (t) specialists[slug] = t;
  }
  return { ...coreTools, ...specialists };
}

export function specialistPool(): Array<{ slug: string; description: string; api: string }> {
  return SPECIALIST_SLUGS.map((slug) => {
    const m = metaFor(slug);
    return { slug, description: m.description, api: m.api };
  });
}

