/** Shapes shared between the API routes and the worker via BullMQ. */

export interface JobFileRef {
  /** Filename on disk under jobs/<id>/in/ — always `f<N>.<ext>`, never user input. */
  stored: string;
  /** Original upload name (sanitized), used to derive output names. */
  original: string;
}

export interface JobData {
  toolId: string;
  options: Record<string, unknown>;
  files: JobFileRef[];
}

export interface JobResult {
  /** Output filenames under jobs/<id>/out/. */
  files: { name: string; size: number }[];
}

export type JobStatusState = "processing" | "done" | "error";

export interface JobStatus {
  id: string;
  state: JobStatusState;
  files?: JobResult["files"];
  error?: string;
}

export const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
