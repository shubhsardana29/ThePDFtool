import { stat } from "node:fs/promises";
import path from "node:path";
import { Worker } from "bullmq";
import { SERVER_OPS } from "@/lib/engine-server";
import { UserFacingError } from "@/lib/engine-server/types";
import { QUEUE_NAME, REDIS_URL } from "@/lib/server/config";
import type { JobData, JobResult } from "@/lib/server/jobs";
import { cleanupExpiredJobs, jobInDir, jobOutDir } from "@/lib/server/storage";

const worker = new Worker<JobData, JobResult>(
  QUEUE_NAME,
  async (job) => {
    const jobId = job.id!;
    const { toolId, options, files } = job.data;
    const op = SERVER_OPS[toolId];
    if (!op) throw new Error(`Unknown tool: ${toolId}`);

    const inDir = jobInDir(jobId);
    const outDir = jobOutDir(jobId);
    const inputs = files.map((f) => ({
      path: path.join(inDir, f.stored),
      original: f.original,
    }));

    console.log(`[worker] ${toolId} job ${jobId} (${files.length} file(s))`);
    let names: string[];
    try {
      names = await op({ files: inputs, outDir, options });
    } catch (err) {
      if (err instanceof UserFacingError) throw err;
      // System errors may contain paths or internals — log them here, but
      // only a generic message reaches the status API.
      console.error(`[worker] internal error in ${toolId} ${jobId}:`, err);
      throw new Error("Processing failed — try again or use a different file");
    }

    const outFiles = await Promise.all(
      names.map(async (name) => ({
        name,
        size: (await stat(path.join(outDir, name))).size,
      })),
    );
    return { files: outFiles };
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2,
  },
);

worker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
worker.on("failed", (job, err) =>
  console.error(`[worker] failed ${job?.id}: ${err.message}`),
);
worker.on("ready", () => console.log("[worker] ready, waiting for jobs"));

// Storage TTL enforcement — runs here so the web process stays stateless.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(async () => {
  const removed = await cleanupExpiredJobs();
  if (removed > 0) console.log(`[worker] cleaned up ${removed} expired job dir(s)`);
}, CLEANUP_INTERVAL_MS);

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
