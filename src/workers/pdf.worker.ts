import { PDFLIB_OPS } from "@/lib/engine-client/pdflib-ops";
import type { EngineFile, EngineOptions } from "@/lib/engine-client/types";

export interface WorkerRequest {
  id: number;
  toolId: string;
  files: EngineFile[];
  options: EngineOptions;
}

export type WorkerResponse =
  | { id: number; ok: true; outputs: EngineFile[] }
  | { id: number; ok: false; error: string };

// In a dedicated worker `self.postMessage` takes (message, transfer) — the DOM
// lib types `self` as Window, so cast to the worker-scoped signature.
const scope = self as unknown as {
  postMessage(message: WorkerResponse, transfer?: ArrayBuffer[]): void;
};

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, toolId, files, options } = e.data;
  try {
    const op = PDFLIB_OPS[toolId];
    if (!op) throw new Error(`Unknown tool: ${toolId}`);
    const outputs = await op(files, options);
    scope.postMessage(
      { id, ok: true, outputs },
      outputs.map((o) => o.data.buffer as ArrayBuffer),
    );
  } catch (err) {
    scope.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
