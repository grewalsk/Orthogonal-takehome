import { cacheKey, type CachedRunResult, withSingleFlight } from "@/lib/cache";

const BASE = process.env.ORTHOGONAL_BASE_URL ?? "https://api.orthogonal.com";

export type ToolErrorCode =
  | "UNAUTHORIZED"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "CIRCUIT_OPEN"
  | "NOT_FOUND"
  | "BAD_REQUEST";

export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly status?: number;
  readonly upstreamRequestId?: string;

  constructor(code: ToolErrorCode, message: string, status?: number, upstreamRequestId?: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.status = status;
    this.upstreamRequestId = upstreamRequestId;
  }
}

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerStats {
  state: BreakerState;
  failureTimestamps: number[];
  openedAt?: number;
}

const FAILURE_WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 60_000;

const breaker: BreakerStats = {
  state: "CLOSED",
  failureTimestamps: [],
};

function checkBreaker(now: number): void {
  if (breaker.state === "OPEN") {
    if (breaker.openedAt !== undefined && now - breaker.openedAt >= OPEN_DURATION_MS) {
      breaker.state = "HALF_OPEN";
      return;
    }
    throw new ToolError("CIRCUIT_OPEN", "Circuit breaker open; data provider degraded");
  }
}

function recordSuccess(): void {
  if (breaker.state === "HALF_OPEN" || breaker.state === "CLOSED") {
    breaker.state = "CLOSED";
    breaker.failureTimestamps = [];
    breaker.openedAt = undefined;
  }
}

function recordFailure(now: number): void {
  if (breaker.state === "HALF_OPEN") {
    breaker.state = "OPEN";
    breaker.openedAt = now;
    return;
  }
  breaker.failureTimestamps = breaker.failureTimestamps.filter((t) => now - t < FAILURE_WINDOW_MS);
  breaker.failureTimestamps.push(now);
  if (breaker.failureTimestamps.length >= FAILURE_THRESHOLD) {
    breaker.state = "OPEN";
    breaker.openedAt = now;
  }
}

export function breakerSnapshot(): Readonly<BreakerStats> {
  return { ...breaker, failureTimestamps: [...breaker.failureTimestamps] };
}

export type ParamWrapper = "query" | "body" | "path";

export interface CallOrthOptions {
  endpointSlug: string;
  api: string;
  path: string;
  paramWrapper: ParamWrapper;
  params: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
  cacheable?: boolean;
  cacheTtlSeconds?: number;
}

export interface CallOrthResult {
  data: unknown;
  priceCents: number;
  upstreamRequestId?: string;
  cacheHit: boolean;
  coalesced: boolean;
}

export async function callOrth(opts: CallOrthOptions): Promise<CallOrthResult> {
  const cacheable = opts.cacheable ?? true;
  if (!cacheable) {
    checkBreaker(Date.now());
    return callWithRetry(opts);
  }

  const key = cacheKey(opts.endpointSlug, opts.params);
  const ttl = opts.cacheTtlSeconds ?? ttlForEndpoint(opts.endpointSlug);

  const { value, cached, coalesced } = await withSingleFlight<CachedRunResult>(
    key,
    ttl,
    async () => {
      checkBreaker(Date.now());
      const result = await callWithRetry(opts);
      return {
        data: result.data,
        priceCents: result.priceCents,
        upstreamRequestId: result.upstreamRequestId,
        cachedAt: Date.now(),
      };
    },
  );

  if (cached) {
    logCall({
      endpoint: opts.endpointSlug,
      durationMs: 0,
      status: 200,
      priceCents: value.priceCents,
      cacheHit: true,
      upstreamRequestId: value.upstreamRequestId,
    });
  }

  return {
    data: value.data,
    priceCents: value.priceCents,
    upstreamRequestId: value.upstreamRequestId,
    cacheHit: cached,
    coalesced,
  };
}

async function callWithRetry(opts: CallOrthOptions): Promise<CallOrthResult> {
  const maxAttempts = (opts.retries ?? 1) + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await callOnce(opts);
      recordSuccess();
      return result;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) {
        if (err instanceof ToolError && err.code !== "BAD_REQUEST" && err.code !== "UNAUTHORIZED") {
          recordFailure(Date.now());
        }
        throw err;
      }
      const backoffMs = 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await sleep(backoffMs);
    }
  }
  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof ToolError) {
    return err.code === "RATE_LIMITED" || err.code === "UPSTREAM_ERROR" || err.code === "TIMEOUT";
  }
  return false;
}

async function callOnce(opts: CallOrthOptions): Promise<CallOrthResult> {
  const key = process.env.ORTHOGONAL_API_KEY;
  if (!key) {
    throw new ToolError("UNAUTHORIZED", "ORTHOGONAL_API_KEY is not configured");
  }
  const timeoutMs = opts.timeoutMs ?? timeoutForEndpoint(opts.endpointSlug, opts.api);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  const wrapperField = opts.paramWrapper;
  const body: Record<string, unknown> = {
    api: opts.api,
    path: opts.path,
  };
  if (wrapperField === "query") {
    // Orthogonal forwards query values to upstream as-is (no coercion). Some
    // providers (e.g. predictleads) reject numeric values with "Expected
    // string, received number" even when their schema labels the field
    // integer. HTTP query strings are inherently strings, so stringifying
    // primitives here is universally safe.
    body[wrapperField] = Object.fromEntries(
      Object.entries(opts.params).map(([k, v]) => [k, stringifyPrimitive(v)]),
    );
  } else {
    body[wrapperField] = opts.params;
  }

  try {
    const res = await fetch(`${BASE}/v1/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "orthogonal-chat/0.1",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text.slice(0, 500) };
    }

    const upstreamRequestId =
      typeof json.requestId === "string" ? json.requestId : undefined;

    if (!res.ok || json.success === false) {
      const orthCode = typeof json.code === "string" ? json.code : undefined;
      const code = mapErrorCode(res.status, orthCode);
      const message =
        typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
      logCall({
        endpoint: opts.endpointSlug,
        durationMs: ms,
        status: res.status,
        priceCents: 0,
        cacheHit: false,
        upstreamRequestId,
        errorCode: code,
      });
      throw new ToolError(code, message, res.status, upstreamRequestId);
    }

    // Some upstreams (e.g. serper at 0.2c) return fractional cents. The
    // tool_calls.price_cents column is integer, so we round here. Loss of
    // precision is sub-cent (< $0.01) and the cost meter is best-effort
    // already; a numeric/decimal migration is a candidate Phase 9 cleanup.
    const rawPriceCents = typeof json.priceCents === "number" ? json.priceCents : 0;
    const priceCents = Math.round(rawPriceCents);
    logCall({
      endpoint: opts.endpointSlug,
      durationMs: ms,
      status: res.status,
      priceCents,
      cacheHit: false,
      upstreamRequestId,
    });
    return {
      data: json.data,
      priceCents,
      upstreamRequestId,
      cacheHit: false,
      coalesced: false,
    };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      logCall({
        endpoint: opts.endpointSlug,
        durationMs: Date.now() - started,
        status: 0,
        priceCents: 0,
        cacheHit: false,
        errorCode: "TIMEOUT",
      });
      throw new ToolError("TIMEOUT", `Request to ${opts.api} ${opts.path} timed out after ${timeoutMs}ms`);
    }
    const message = err instanceof Error ? err.message : String(err);
    logCall({
      endpoint: opts.endpointSlug,
      durationMs: Date.now() - started,
      status: 0,
      priceCents: 0,
      cacheHit: false,
      errorCode: "UPSTREAM_ERROR",
    });
    throw new ToolError("UPSTREAM_ERROR", message);
  } finally {
    clearTimeout(timer);
  }
}

function mapErrorCode(httpStatus: number, orthCode?: string): ToolErrorCode {
  switch (orthCode) {
    case "UNAUTHORIZED":
      return "UNAUTHORIZED";
    case "INSUFFICIENT_CREDITS":
      return "INSUFFICIENT_CREDITS";
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "UPSTREAM_ERROR":
      return "UPSTREAM_ERROR";
  }
  if (httpStatus === 401) return "UNAUTHORIZED";
  if (httpStatus === 402) return "INSUFFICIENT_CREDITS";
  if (httpStatus === 404) return "NOT_FOUND";
  if (httpStatus === 429) return "RATE_LIMITED";
  if (httpStatus === 400 || httpStatus === 422) return "BAD_REQUEST";
  if (httpStatus >= 500) return "UPSTREAM_ERROR";
  return "UPSTREAM_ERROR";
}

// Per-endpoint upstream timeout. Overrides are by slug (more specific)
// then by api (provider default). Anything not matched falls through to
// 30s, which was the prior global default. Values chosen from upstream
// behavior observed during Phase 8 probes.
const TIMEOUT_BY_SLUG: Record<string, number> = {
  olostep_answers: 90_000,
  olostep_scrapes: 60_000,
};
const TIMEOUT_BY_API: Record<string, number> = {
  apollo: 10_000,
  hunter: 10_000,
  tomba: 10_000,
  logo: 10_000,
  serper: 15_000,
  precip: 15_000,
  fundable: 20_000,
  "brand-dev": 20_000,
  linkup: 30_000,
  exa: 30_000,
  predictleads: 45_000,
  elevenlabs: 30_000,
  didit: 30_000,
};
const DEFAULT_TIMEOUT_MS = 30_000;

export function timeoutForEndpoint(endpointSlug: string, api?: string): number {
  if (endpointSlug in TIMEOUT_BY_SLUG) return TIMEOUT_BY_SLUG[endpointSlug];
  if (api && api in TIMEOUT_BY_API) return TIMEOUT_BY_API[api];
  return DEFAULT_TIMEOUT_MS;
}

export function ttlForEndpoint(endpointSlug: string): number {
  if (endpointSlug.includes("organizations_enrich") || endpointSlug.includes("companies_find")) return 86_400;
  if (endpointSlug.includes("people_match")) return 86_400;
  if (endpointSlug.includes("email_verifier")) return 86_400;
  if (endpointSlug.includes("domain_search") || endpointSlug.includes("email_finder")) return 21_600;
  if (endpointSlug.includes("people_search") || endpointSlug.includes("mixed_people")) return 21_600;
  if (endpointSlug.includes("search")) return 300;
  if (endpointSlug.includes("scrapes")) return 3_600;
  return 3_600;
}

interface LogEntry {
  endpoint: string;
  durationMs: number;
  status: number;
  priceCents: number;
  cacheHit: boolean;
  upstreamRequestId?: string;
  errorCode?: ToolErrorCode;
}

function logCall(entry: LogEntry): void {
  console.log(JSON.stringify({ tag: "orth.call", ...entry }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyPrimitive(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === "string" || t === "object") return v;
  return String(v);
}
