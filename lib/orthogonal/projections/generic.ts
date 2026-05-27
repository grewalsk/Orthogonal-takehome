// Generic projection helpers for endpoints without a hand-tuned projection.
// Used by the dynamic-palette specialist tier in tools.generated.ts.
//
// buildInputSchema: derives a Zod object schema from a CatalogEndpoint's
// pathParams + queryParams (GET/DELETE) or pathParams + bodyParams (POST/PUT/
// PATCH). Required vs optional follows the catalog's required flag.
//
// genericProject: walks an arbitrary upstream JSON response and produces the
// standard {result_id, endpoint, summary, available_paths, price_usd} shape.
// Scalars under MAX_DEPTH go into summary. Arrays and deeper-than-MAX objects
// go into available_paths so the model can drill in via read_tool_result.
//
// Tradeoffs vs hand-tuned projections:
// - Generic projections include more raw field names; hand-tuned ones pick
//   the salient 4-8 fields per endpoint. Generic is broader, less polished.
// - Generic projections do not apply wrapUntrusted to untrusted strings.
//   Hand-tune any endpoint that returns LLM-summarized or user-attacker
//   controlled text (search results, scraped pages) instead of relying on
//   this fallback.

import { z } from "zod";
import type { CatalogEndpoint, CatalogParam } from "@/lib/orthogonal/catalog.generated";

const MAX_DEPTH = 4;
const MAX_SUMMARY_FIELDS = 14;
const MAX_AVAILABLE_PATHS = 12;
const STRING_TRUNCATE = 240;

export function buildInputSchema(endpoint: CatalogEndpoint): z.ZodObject<z.ZodRawShape> {
  const params = paramsForMethod(endpoint);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    let base: z.ZodTypeAny = zodForType(p.type);
    if (p.description) base = base.describe(p.description);
    shape[p.name] = p.required ? base : base.optional();
  }
  return z.object(shape as z.ZodRawShape);
}

export interface GenericProjection {
  result_id: string;
  endpoint: string;
  summary: Record<string, unknown>;
  available_paths: string[];
  price_usd: number;
}

export function genericProject(
  raw: unknown,
  result_id: string,
  price_usd: number,
  endpointLabel: string,
): GenericProjection {
  const summary: Record<string, unknown> = {};
  const paths: string[] = [];
  walk(raw, "$", 0, summary, paths);
  return {
    result_id,
    endpoint: endpointLabel,
    summary: capObject(summary, MAX_SUMMARY_FIELDS),
    available_paths: dedup(paths).slice(0, MAX_AVAILABLE_PATHS),
    price_usd,
  };
}

function paramsForMethod(endpoint: CatalogEndpoint): CatalogParam[] {
  if (endpoint.method === "GET" || endpoint.method === "DELETE") {
    return [...endpoint.pathParams, ...endpoint.queryParams];
  }
  return [...endpoint.pathParams, ...endpoint.bodyParams];
}

function zodForType(type: string): z.ZodTypeAny {
  const t = type.toLowerCase();
  if (t === "string") return z.string();
  if (t === "number" || t === "integer" || t === "int" || t === "float") return z.number();
  if (t === "boolean" || t === "bool") return z.boolean();
  if (t === "array") return z.array(z.unknown());
  if (t === "object") return z.object({}).passthrough();
  return z.unknown();
}

function walk(
  value: unknown,
  path: string,
  depth: number,
  summary: Record<string, unknown>,
  paths: string[],
): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "object") {
    summary[path] = truncate(value);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    paths.push(`${path}[*]`);
    return;
  }
  if (depth >= MAX_DEPTH) {
    paths.push(path);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    walk(v, `${path}.${k}`, depth + 1, summary, paths);
  }
}

function truncate(v: unknown): unknown {
  if (typeof v === "string" && v.length > STRING_TRUNCATE) {
    return v.slice(0, STRING_TRUNCATE) + "...";
  }
  return v;
}

function capObject(obj: Record<string, unknown>, max: number): Record<string, unknown> {
  const entries = Object.entries(obj);
  if (entries.length <= max) return obj;
  return Object.fromEntries(entries.slice(0, max));
}

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
