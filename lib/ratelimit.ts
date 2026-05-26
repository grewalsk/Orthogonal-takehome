import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/upstash";

let activeChatRatelimit: Ratelimit | null = null;

export function getChatRatelimit(): Ratelimit | null {
  if (activeChatRatelimit) return activeChatRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  activeChatRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:chat",
    analytics: false,
  });
  return activeChatRatelimit;
}
