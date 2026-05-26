// AUTO-DERIVABLE from lib/orthogonal/catalog.generated.ts plus
// lib/orthogonal/projections/*. The structure is mechanical: one tool() per
// curated slug, all routed through a shared executeTool() helper. Edit by
// hand only when adding or removing a tool. To add a tool: add its entry to
// scripts/curated-endpoints.json, run `pnpm snapshot`, hand-write its
// projection under lib/orthogonal/projections/, then add an import + tools
// entry below.

import { tool } from "ai";
import { callOrth, type ParamWrapper } from "@/lib/orthogonal/client";
import { storeToolResult } from "@/lib/orthogonal/tool-result-store";
import { catalog } from "@/lib/orthogonal/catalog.generated";

import * as apollo_organizations_enrich from "@/lib/orthogonal/projections/apollo-organizations-enrich";
import * as apollo_people_match from "@/lib/orthogonal/projections/apollo-people-match";
import * as apollo_mixed_people_search from "@/lib/orthogonal/projections/apollo-mixed-people-search";
import * as hunter_domain_search from "@/lib/orthogonal/projections/hunter-domain-search";
import * as hunter_email_finder from "@/lib/orthogonal/projections/hunter-email-finder";
import * as hunter_companies_find from "@/lib/orthogonal/projections/hunter-companies-find";
import * as tomba_email_verifier from "@/lib/orthogonal/projections/tomba-email-verifier";
import * as linkup_search from "@/lib/orthogonal/projections/linkup-search";
import * as olostep_scrapes from "@/lib/orthogonal/projections/olostep-scrapes";

type AnyCatalogEntry = (typeof catalog)[number];
const ENDPOINT_BY_SLUG: Map<string, AnyCatalogEntry> = new Map(
  catalog.map((e) => [e.slug as string, e]),
);

interface EndpointMeta {
  api: string;
  path: string;
  paramWrapper: ParamWrapper;
  priceCents: number;
  description: string;
}

function metaFor(slug: string): EndpointMeta {
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
  const price = `$${(m.priceCents / 100).toFixed(2)}`;
  return `${m.description} Costs ${price} per call. Returns a typed projection: summary + available_paths. Use read_tool_result(tr_X, "$.path") for drill-in.`;
}

async function executeTool<InputType, ProjectionType>(
  slug: string,
  input: InputType,
  project: (raw: unknown, result_id: string, price_usd: number) => ProjectionType,
): Promise<ProjectionType> {
  const m = metaFor(slug);
  const result = await callOrth({
    endpointSlug: slug,
    api: m.api,
    path: m.path,
    paramWrapper: m.paramWrapper,
    params: input as Record<string, unknown>,
  });
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

export const orthogonalTools = {
  apollo_organizations_enrich: tool({
    description: describe("apollo_organizations_enrich"),
    inputSchema: apollo_organizations_enrich.inputSchema,
    execute: (input) => executeTool("apollo_organizations_enrich", input, apollo_organizations_enrich.project),
  }),
  apollo_people_match: tool({
    description: describe("apollo_people_match"),
    inputSchema: apollo_people_match.inputSchema,
    execute: (input) => executeTool("apollo_people_match", input, apollo_people_match.project),
  }),
  apollo_mixed_people_search: tool({
    description: describe("apollo_mixed_people_search"),
    inputSchema: apollo_mixed_people_search.inputSchema,
    execute: (input) => executeTool("apollo_mixed_people_search", input, apollo_mixed_people_search.project),
  }),
  hunter_domain_search: tool({
    description: describe("hunter_domain_search"),
    inputSchema: hunter_domain_search.inputSchema,
    execute: (input) => executeTool("hunter_domain_search", input, hunter_domain_search.project),
  }),
  hunter_email_finder: tool({
    description: describe("hunter_email_finder"),
    inputSchema: hunter_email_finder.inputSchema,
    execute: (input) => executeTool("hunter_email_finder", input, hunter_email_finder.project),
  }),
  hunter_companies_find: tool({
    description: describe("hunter_companies_find"),
    inputSchema: hunter_companies_find.inputSchema,
    execute: (input) => executeTool("hunter_companies_find", input, hunter_companies_find.project),
  }),
  tomba_email_verifier: tool({
    description: describe("tomba_email_verifier"),
    inputSchema: tomba_email_verifier.inputSchema,
    execute: (input) => executeTool("tomba_email_verifier", input, tomba_email_verifier.project),
  }),
  linkup_search: tool({
    description: describe("linkup_search"),
    inputSchema: linkup_search.inputSchema,
    execute: (input) => executeTool("linkup_search", input, linkup_search.project),
  }),
  olostep_scrapes: tool({
    description: describe("olostep_scrapes"),
    inputSchema: olostep_scrapes.inputSchema,
    execute: (input) => executeTool("olostep_scrapes", input, olostep_scrapes.project),
  }),
};

export type OrthogonalToolName = keyof typeof orthogonalTools;
