import { readFile } from "node:fs/promises";
import { Job } from "bullmq";
import { zipSync } from "fflate";
import { JOB_ID_RE, type JobData, type JobResult } from "@/lib/server/jobs";
import { getQueue } from "@/lib/server/queue";
import { resolveOutFile } from "@/lib/server/storage";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function fileResponse(data: Uint8Array, name: string, mime: string): Response {
  return new Response(data.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  if (!JOB_ID_RE.test(jobId)) {
    return Response.json({ error: "Invalid job id" }, { status: 400 });
  }
  const job = await Job.fromId<JobData, JobResult>(getQueue(), jobId);
  if (!job || (await job.getState()) !== "completed") {
    return Response.json({ error: "Job not found, expired, or not finished" }, { status: 404 });
  }
  const files = job.returnvalue?.files ?? [];
  if (files.length === 0) {
    return Response.json({ error: "No output files" }, { status: 404 });
  }

  // ?file=<name> downloads one specific output; must be in the job's manifest.
  const wanted = new URL(request.url).searchParams.get("file");
  if (wanted) {
    const entry = files.find((f) => f.name === wanted);
    if (!entry) return Response.json({ error: "No such file" }, { status: 404 });
    const data = await readFile(resolveOutFile(jobId, entry.name));
    const ext = entry.name.split(".").pop() ?? "";
    return fileResponse(data, entry.name, MIME_BY_EXT[ext] ?? "application/octet-stream");
  }

  if (files.length === 1) {
    const data = await readFile(resolveOutFile(jobId, files[0].name));
    const ext = files[0].name.split(".").pop() ?? "";
    return fileResponse(data, files[0].name, MIME_BY_EXT[ext] ?? "application/octet-stream");
  }

  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    entries[f.name] = await readFile(resolveOutFile(jobId, f.name));
  }
  return fileResponse(zipSync(entries, { level: 6 }), `${job.data.toolId}.zip`, "application/zip");
}
