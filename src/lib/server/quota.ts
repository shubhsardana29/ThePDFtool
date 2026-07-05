import Redis from "ioredis";
import { REDIS_URL } from "./config";

// One Redis connection per process, hot-reload safe.
const globalForQuota = globalThis as unknown as { quotaRedis?: Redis };

function getRedis(): Redis {
  if (!globalForQuota.quotaRedis) {
    globalForQuota.quotaRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  }
  return globalForQuota.quotaRedis;
}

/** Health-check helper — true when Redis answers PONG. */
export async function pingRedis(): Promise<boolean> {
  try {
    return (await getRedis().ping()) === "PONG";
  } catch {
    return false;
  }
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * Count one job against the subject's daily quota (UTC day). Keys expire on
 * their own, so there's nothing to clean up.
 */
export async function consumeDailyQuota(
  subject: string,
  limit: number,
): Promise<QuotaResult> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${day}:${subject}`;
  const redis = getRedis();
  const used = await redis.incr(key);
  if (used === 1) {
    await redis.expire(key, 25 * 60 * 60); // day boundary + slack
  }
  if (used > limit) {
    // Over-limit attempts shouldn't burn quota.
    await redis.decr(key);
    return { allowed: false, used: limit, limit };
  }
  return { allowed: true, used, limit };
}
