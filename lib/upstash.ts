import { Redis } from "@upstash/redis";

let activeRedis: Redis | null = null;

export function getRedis(): Redis | null {
  if (activeRedis) return activeRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  activeRedis = new Redis({ url, token });
  return activeRedis;
}
