import { createHash } from "node:crypto";

export interface CachedRunResult {
  data: unknown;
  priceCents: number;
  upstreamRequestId?: string;
  cachedAt: number;
}

export interface CacheClient {
  get<T = CachedRunResult>(key: string): Promise<T | null>;
  set(key: string, value: CachedRunResult, ttlSeconds: number): Promise<void>;
}

class NoopCache implements CacheClient {
  async get<T = CachedRunResult>(): Promise<T | null> {
    return null;
  }
  async set(): Promise<void> {
    return;
  }
}

let activeClient: CacheClient = new NoopCache();

export function setCacheClient(client: CacheClient): void {
  activeClient = client;
}

export function getCacheClient(): CacheClient {
  return activeClient;
}

export function canonicalJSON(input: unknown): string {
  return JSON.stringify(canonicalize(input));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    let v: unknown = obj[k];
    if (typeof v === "string" && /email/i.test(k)) {
      v = v.toLowerCase();
    }
    out[k] = canonicalize(v);
  }
  return out;
}

export function cacheKey(endpointSlug: string, payload: unknown): string {
  const hash = createHash("sha256").update(canonicalJSON(payload)).digest("hex");
  return `orth:${endpointSlug}:${hash}`;
}
