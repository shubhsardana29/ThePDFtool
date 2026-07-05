import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { JOB_TTL_SECONDS, STORAGE_DIR } from "./config";
import { JOB_ID_RE } from "./jobs";

export function jobDir(jobId: string): string {
  if (!JOB_ID_RE.test(jobId)) throw new Error("Invalid job id");
  return path.join(STORAGE_DIR, "jobs", jobId);
}

export function jobInDir(jobId: string): string {
  return path.join(jobDir(jobId), "in");
}

export function jobOutDir(jobId: string): string {
  return path.join(jobDir(jobId), "out");
}

export async function createJobDirs(jobId: string): Promise<void> {
  await mkdir(jobInDir(jobId), { recursive: true });
  await mkdir(jobOutDir(jobId), { recursive: true });
}

/**
 * Resolve an output filename inside a job's out dir, refusing anything that
 * escapes it (defense in depth — names come from our own worker, but the
 * download route treats them as untrusted anyway).
 */
export function resolveOutFile(jobId: string, name: string): string {
  const dir = jobOutDir(jobId);
  const resolved = path.resolve(dir, name);
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error("Invalid file name");
  }
  return resolved;
}

/** Delete job directories older than the TTL. Returns how many were removed. */
export async function cleanupExpiredJobs(): Promise<number> {
  const root = path.join(STORAGE_DIR, "jobs");
  let removed = 0;
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return 0; // storage dir doesn't exist yet
  }
  const cutoff = Date.now() - JOB_TTL_SECONDS * 1000;
  for (const entry of entries) {
    if (!JOB_ID_RE.test(entry)) continue;
    const dir = path.join(root, entry);
    try {
      const info = await stat(dir);
      if (info.mtimeMs < cutoff) {
        await rm(dir, { recursive: true, force: true });
        removed++;
      }
    } catch {
      // raced with another cleanup — ignore
    }
  }
  return removed;
}
