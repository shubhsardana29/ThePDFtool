import { RATE_LIMIT_JOBS, RATE_LIMIT_WINDOW_MS } from "./config";

// In-memory sliding window per IP. Fine for a single-process deployment;
// swap for a Redis-backed limiter when scaling out.
const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_JOBS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic pruning so the map doesn't grow unboundedly.
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= windowStart)) hits.delete(key);
    }
  }
  return true;
}
