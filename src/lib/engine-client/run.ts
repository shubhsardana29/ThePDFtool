import type { ToolDefinition } from "@/lib/tools/types";
import type {
  WorkerRequest,
  WorkerResponse,
} from "@/workers/pdf.worker";
import type { EngineFile, EngineOptions } from "./types";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (outputs: EngineFile[]) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/pdf.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const entry = pending.get(e.data.id);
      if (!entry) return;
      pending.delete(e.data.id);
      if (e.data.ok) entry.resolve(e.data.outputs);
      else entry.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      const error = new Error("PDF worker crashed");
      pending.forEach((entry) => entry.reject(error));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function runInWorker(
  toolId: string,
  files: EngineFile[],
  options: EngineOptions,
): Promise<EngineFile[]> {
  const id = nextId++;
  const request: WorkerRequest = { id, toolId, files, options };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(
      request,
      files.map((f) => f.data.buffer as ArrayBuffer),
    );
  });
}

/** Run a client-side tool. Files are consumed (their buffers are transferred). */
export async function runClientTool(
  tool: ToolDefinition,
  files: EngineFile[],
  options: EngineOptions,
): Promise<EngineFile[]> {
  if (tool.id === "pdf-to-jpg") {
    // Needs canvas rendering — runs on the main thread via pdfjs.
    const { pdfToJpg } = await import("./render");
    return pdfToJpg(files, options);
  }
  if (tool.id === "pdf-to-text") {
    // Uses the pdfjs text layer — main thread, like pdf-to-jpg.
    const { pdfToText } = await import("./render");
    return pdfToText(files, options);
  }
  return runInWorker(tool.id, files, options);
}
