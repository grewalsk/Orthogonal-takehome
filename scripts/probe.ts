import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

dotenv.config({ path: ".env.local" });

const BASE = "https://api.orthogonal.com";
const KEY = process.env.ORTHOGONAL_API_KEY;
if (!KEY) {
  console.error("ORTHOGONAL_API_KEY missing in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

interface CallResult {
  status: number;
  durationMs: number;
  json: unknown;
}

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<CallResult> {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const durationMs = Date.now() - started;
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawBody: text };
  }
  return { status: res.status, durationMs, json };
}

interface ProbeRecord {
  label: string;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  durationMs: number;
  json: unknown;
  notes?: string;
  required?: boolean;
}

const records: ProbeRecord[] = [];
let requiredFailures = 0;

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "zuplo-key", pattern: /zpka_[a-f0-9_]{20,}/g },
  { name: "anthropic-key", pattern: /sk-ant-[A-Za-z0-9_-]{30,}/g },
  { name: "openai-key", pattern: /sk-[A-Za-z0-9_-]{32,}/g },
  { name: "orthogonal-key", pattern: /orth_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g },
];

function sanitize(value: unknown): unknown {
  let text = JSON.stringify(value);
  for (const { pattern } of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED-secret-pattern]");
  }
  return JSON.parse(text);
}

async function step(
  label: string,
  method: "GET" | "POST",
  path: string,
  opts: { body?: unknown; notes?: string; required?: boolean } = {},
): Promise<ProbeRecord> {
  const { body, notes, required = true } = opts;
  let rec: ProbeRecord;
  try {
    const r = await call(method, path, body);
    rec = { label, method, path, body, ...r, notes, required };
  } catch (err) {
    rec = {
      label,
      method,
      path,
      body,
      status: 0,
      durationMs: 0,
      json: { fetchError: err instanceof Error ? err.message : String(err) },
      notes,
      required,
    };
  }
  const ok = rec.status >= 200 && rec.status < 300;
  if (!ok && required) requiredFailures++;
  records.push(rec);
  const tag = ok ? "OK  " : required ? "FAIL" : "SKIP";
  console.log(
    `[${tag}] ${label.padEnd(28)} ${String(rec.status).padStart(3)}  ${String(rec.durationMs).padStart(5)}ms  ${method} ${path}`,
  );
  return rec;
}

interface CatalogEndpoint {
  apiSlug: string;
  apiName: string;
  path: string;
  method: string;
  description: string;
  isPayable: boolean;
  queryParams: Array<{ name: string; required: boolean; type: string }>;
  bodyParams: Array<{ name: string; required: boolean; type: string }>;
}

function flattenCatalog(catalogJson: unknown): CatalogEndpoint[] {
  const c = catalogJson as { apis?: Array<Record<string, unknown>> };
  if (!c?.apis || !Array.isArray(c.apis)) return [];
  const out: CatalogEndpoint[] = [];
  for (const api of c.apis) {
    const slug = String(api.slug ?? "");
    const name = String(api.name ?? slug);
    const endpoints = Array.isArray(api.endpoints) ? (api.endpoints as Array<Record<string, unknown>>) : [];
    for (const e of endpoints) {
      out.push({
        apiSlug: slug,
        apiName: name,
        path: String(e.path ?? ""),
        method: String(e.method ?? "GET"),
        description: String(e.description ?? ""),
        isPayable: Boolean(e.isPayable),
        queryParams: (Array.isArray(e.queryParams) ? e.queryParams : []) as CatalogEndpoint["queryParams"],
        bodyParams: (Array.isArray(e.bodyParams) ? e.bodyParams : []) as CatalogEndpoint["bodyParams"],
      });
    }
  }
  return out;
}

async function tryRunShapes(
  apiSlug: string,
  path: string,
  paramName: string,
  paramValue: string,
): Promise<ProbeRecord> {
  const shapes: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: "run-tomba (body)", payload: { api: apiSlug, path, body: { [paramName]: paramValue } } },
    { label: "run-tomba (query)", payload: { api: apiSlug, path, query: { [paramName]: paramValue } } },
    { label: "run-tomba (params)", payload: { api: apiSlug, path, params: { [paramName]: paramValue } } },
  ];
  let last: ProbeRecord | null = null;
  for (const shape of shapes) {
    const rec = await step(shape.label, "POST", "/v1/run", {
      body: shape.payload,
      notes: `Trying request shape: ${Object.keys(shape.payload).filter((k) => k !== "api" && k !== "path").join(", ")}`,
      required: false,
    });
    last = rec;
    if (rec.status >= 200 && rec.status < 300) {
      console.log(`  ^ this shape worked. Using "${Object.keys(shape.payload).find((k) => k !== "api" && k !== "path")}" wrapper.`);
      return rec;
    }
  }
  if (last && requiredFailures === 0) {
    requiredFailures++;
  }
  return last!;
}

async function main() {
  console.log(`Probing ${BASE}\n`);

  const listRec = await step("list-endpoints", "GET", "/v1/list-endpoints");

  const endpoints = listRec.status >= 200 && listRec.status < 300
    ? flattenCatalog(listRec.json)
    : [];

  if (endpoints.length > 0) {
    const providers = new Set(endpoints.map((e) => e.apiSlug));
    console.log(`  Catalog: ${endpoints.length} endpoints across ${providers.size} providers.\n`);
  }

  const tombaVerifier = endpoints.find(
    (e) => e.apiSlug === "tomba" && e.path === "/v1/email-verifier",
  );

  if (tombaVerifier) {
    console.log(`Selected: ${tombaVerifier.apiSlug} ${tombaVerifier.path} (${tombaVerifier.method})\n`);
    await step("details-tomba-verifier", "POST", "/v1/details", {
      body: { api: tombaVerifier.apiSlug, path: tombaVerifier.path },
    });
    await step("integrate-tomba-verifier", "POST", "/v1/integrate", {
      body: { api: tombaVerifier.apiSlug, path: tombaVerifier.path },
      notes: "Returns curl/TS/Python snippets that show the exact /v1/run shape.",
    });
  } else {
    console.warn("Tomba /v1/email-verifier not found in catalog. Details + run skipped.\n");
  }

  for (const balancePath of ["/v1/balance", "/v1/account", "/v1/credits", "/v1/me"]) {
    await step(`balance? (${balancePath})`, "GET", balancePath, { required: false });
  }

  if (tombaVerifier) {
    await tryRunShapes("tomba", "/v1/email-verifier", "email", "support@vercel.com");
  }

  mkdirSync("notes", { recursive: true });
  const out = resolve("notes/probe-output.json");
  const cleaned = sanitize(records) as ProbeRecord[];
  writeFileSync(
    out,
    JSON.stringify(
      { timestamp: new Date().toISOString(), base: BASE, records: cleaned },
      null,
      2,
    ),
  );
  console.log(`\nFull envelopes written to ${out}`);
  console.log(
    requiredFailures === 0
      ? `All required check(s) passed.`
      : `${requiredFailures} required check(s) failed.`,
  );
  process.exit(requiredFailures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
