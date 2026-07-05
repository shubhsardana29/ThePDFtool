import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import {
  JOB_TTL_SECONDS,
  MAX_FILES_PER_JOB,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "@/lib/server/config";
import type { JobData, JobFileRef } from "@/lib/server/jobs";
import { getQueue } from "@/lib/server/queue";
import { consumeDailyQuota } from "@/lib/server/quota";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { TIER_LIMITS, type Tier } from "@/lib/server/tiers";
import { createJobDirs, jobInDir } from "@/lib/server/storage";
import {
  TOOL_INPUT_EXTS,
  fileExtension,
  sanitizeName,
  sniffMatchesExt,
} from "@/lib/server/validate";
import { getTool } from "@/lib/tools/registry";

function bad(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return bad(429, "Too many jobs — try again in a few minutes");
  }

  // Signed-in users get the free tier; anonymous users are keyed by IP.
  const session = await auth();
  const tier: Tier = session?.user ? "free" : "anon";
  const limits = TIER_LIMITS[tier];
  const quotaSubject = session?.user?.email ?? `ip:${ip}`;
  const quota = await consumeDailyQuota(quotaSubject, limits.jobsPerDay);
  if (!quota.allowed) {
    return bad(
      429,
      tier === "anon"
        ? `Daily limit reached (${limits.jobsPerDay} jobs) — sign in for a higher limit`
        : `Daily limit reached (${limits.jobsPerDay} jobs) — try again tomorrow`,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad(400, "Expected multipart form data");
  }

  const toolId = String(form.get("toolId") ?? "");
  const tool = getTool(toolId);
  const allowedExts = TOOL_INPUT_EXTS[toolId];
  if (!tool || tool.runtime !== "server" || !allowedExts) {
    return bad(400, "Unknown tool");
  }

  let options: Record<string, unknown>;
  try {
    options = JSON.parse(String(form.get("options") ?? "{}"));
  } catch {
    return bad(400, "Invalid options");
  }
  const parsed = tool.optionsSchema.safeParse(options);
  if (!parsed.success) {
    return bad(400, parsed.error.issues.map((i) => i.message).join(" · "));
  }

  const uploads = form.getAll("files").filter((f): f is File => f instanceof File);
  if (uploads.length < tool.minFiles || uploads.length > Math.min(tool.maxFiles, MAX_FILES_PER_JOB)) {
    return bad(400, `This tool takes ${tool.minFiles}–${tool.maxFiles} file(s)`);
  }
  const totalBytes = uploads.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return bad(413, "Files exceed the 200 MB per-job limit");
  }

  const jobId = randomUUID();
  await createJobDirs(jobId);
  const inDir = jobInDir(jobId);
  const fileRefs: JobFileRef[] = [];

  for (let i = 0; i < uploads.length; i++) {
    const upload = uploads[i];
    if (upload.size === 0) return bad(400, "Empty file");
    const maxBytes = Math.min(limits.maxFileBytes, MAX_FILE_BYTES);
    if (upload.size > maxBytes) {
      const mb = Math.floor(maxBytes / (1024 * 1024));
      return bad(
        413,
        `${sanitizeName(upload.name)} exceeds the ${mb} MB ${limits.label} limit` +
          (tier === "anon" ? " — sign in to raise it" : ""),
      );
    }
    const ext = fileExtension(upload.name);
    if (!allowedExts.includes(ext)) {
      return bad(415, `This tool accepts: ${allowedExts.map((e) => `.${e}`).join(", ")}`);
    }
    const data = new Uint8Array(await upload.arrayBuffer());
    if (!sniffMatchesExt(data, ext)) {
      return bad(415, `${sanitizeName(upload.name)} does not look like a .${ext} file`);
    }
    // Stored name is fully synthetic — user input never touches the filesystem.
    const stored = `f${i}.${ext}`;
    await writeFile(path.join(inDir, stored), data);
    fileRefs.push({ stored, original: sanitizeName(upload.name) });
  }

  const jobData: JobData = { toolId, options: parsed.data as Record<string, unknown>, files: fileRefs };
  await getQueue().add(toolId, jobData, {
    jobId,
    removeOnComplete: { age: JOB_TTL_SECONDS },
    removeOnFail: { age: JOB_TTL_SECONDS },
  });

  return Response.json({ id: jobId }, { status: 201 });
}
