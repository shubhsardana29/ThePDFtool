import type { JobStatus } from "@/lib/server/jobs";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export interface ServerJobResult {
  jobId: string;
  files: { name: string; size: number }[];
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // non-JSON error body
  }
  return fallback;
}

/** Submit files to /api/jobs and poll until the job finishes or fails. */
export async function runServerTool(
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
): Promise<ServerJobResult> {
  const form = new FormData();
  form.set("toolId", toolId);
  form.set("options", JSON.stringify(options));
  for (const file of files) form.append("files", file, file.name);

  const submit = await fetch("/api/jobs", { method: "POST", body: form });
  if (!submit.ok) {
    throw new Error(await parseError(submit, "Upload failed"));
  }
  const { id } = (await submit.json()) as { id: string };

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) {
      throw new Error(await parseError(res, "Lost track of the job"));
    }
    const status = (await res.json()) as JobStatus;
    if (status.state === "done") {
      return { jobId: id, files: status.files ?? [] };
    }
    if (status.state === "error") {
      throw new Error(status.error ?? "Processing failed");
    }
  }
  throw new Error("Timed out waiting for the job — try again");
}

export function downloadUrl(jobId: string, file?: string): string {
  const base = `/api/jobs/${jobId}/download`;
  return file ? `${base}?file=${encodeURIComponent(file)}` : base;
}
