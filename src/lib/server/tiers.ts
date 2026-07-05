export type Tier = "anon" | "free" | "premium";

export interface TierLimits {
  label: string;
  jobsPerDay: number;
  maxFileBytes: number;
}

const MB = 1024 * 1024;

/**
 * Server-job quotas by account tier. "premium" exists so the enforcement
 * path is tier-complete, but nothing assigns it yet — that arrives with
 * billing. Client-side tools are unlimited and unmetered by design.
 */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  anon: { label: "Anonymous", jobsPerDay: 10, maxFileBytes: 50 * MB },
  free: { label: "Free account", jobsPerDay: 50, maxFileBytes: 100 * MB },
  premium: { label: "Premium", jobsPerDay: 500, maxFileBytes: 200 * MB },
};
