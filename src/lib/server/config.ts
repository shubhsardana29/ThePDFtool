import path from "node:path";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
export const GOTENBERG_URL = process.env.GOTENBERG_URL ?? "http://127.0.0.1:3001";
export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR ?? "./storage");

export const QUEUE_NAME = "pdf-jobs";

// Hard limits, enforced at upload time — never trust the client.
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB per job
export const MAX_FILES_PER_JOB = 10;

// Files are deleted this long after job creation.
export const JOB_TTL_SECONDS = 60 * 60; // 1 hour

// Per-IP rate limit for job submission.
export const RATE_LIMIT_JOBS = 20;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export const EXEC_TIMEOUT_MS = 3 * 60 * 1000; // per shell-out
