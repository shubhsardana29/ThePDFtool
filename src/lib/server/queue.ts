import { Queue } from "bullmq";
import { QUEUE_NAME, REDIS_URL } from "./config";

// Next dev hot-reloads modules; keep one Queue (and its Redis connection)
// per process via globalThis.
const globalForQueue = globalThis as unknown as { pdfQueue?: Queue };

export function getQueue(): Queue {
  if (!globalForQueue.pdfQueue) {
    globalForQueue.pdfQueue = new Queue(QUEUE_NAME, {
      connection: { url: REDIS_URL },
    });
  }
  return globalForQueue.pdfQueue;
}
