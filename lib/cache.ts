import { createHash } from "node:crypto";
import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/upstash";

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

class UpstashCache implements CacheClient {
  constructor(private redis: Redis) {}

  async get<T = CachedRunResult>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    return value ?? null;
  }

  async set(key: string, value: CachedRunResult, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }
}

let activeClient: CacheClient = new NoopCache();
let initialized = false;

function autoInit(): void {
  if (initialized) return;
  initialized = true;
  const redis = getRedis();
  if (redis && activeClient instanceof NoopCache) {
    activeClient = new UpstashCache(redis);
  }
}

export function setCacheClient(client: CacheClient): void {
  activeClient = client;
  initialized = true;
}

export function getCacheClient(): CacheClient {
  autoInit();
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
