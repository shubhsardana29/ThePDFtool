import { Job } from "bullmq";
import type { JobStatus } from "@/lib/server/jobs";
import { JOB_ID_RE, type JobData, type JobResult } from "@/lib/server/jobs";
import { getQueue } from "@/lib/server/queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  if (!JOB_ID_RE.test(jobId)) {
    return Response.json({ error: "Invalid job id" }, { status: 400 });
  }
  const job = await Job.fromId<JobData, JobResult>(getQueue(), jobId);
  if (!job) {
    return Response.json({ error: "Job not found or expired" }, { status: 404 });
  }

  const state = await job.getState();
  const status: JobStatus =
    state === "completed"
      ? { id: jobId, state: "done", files: job.returnvalue?.files ?? [] }
      : state === "failed"
        ? { id: jobId, state: "error", error: job.failedReason || "Processing failed" }
        : { id: jobId, state: "processing" };

  return Response.json(status);
}
