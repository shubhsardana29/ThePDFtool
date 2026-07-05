import { access, constants } from "node:fs/promises";
import { STORAGE_DIR } from "@/lib/server/config";
import { pingRedis } from "@/lib/server/quota";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for deploy checks and uptime monitoring. */
export async function GET(): Promise<Response> {
  const checks: Record<string, "ok" | "fail"> = { redis: "fail", storage: "fail" };

  if (await pingRedis()) checks.redis = "ok";
  try {
    await access(STORAGE_DIR, constants.W_OK);
    checks.storage = "ok";
  } catch {
    // storage dir missing or read-only
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return Response.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
