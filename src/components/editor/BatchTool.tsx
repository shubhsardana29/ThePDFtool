"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadAll } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import type { EngineFile } from "@/lib/engine-client/types";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { OptionsForm } from "@/components/OptionsForm";

// One PDF in → one PDF out, client, form-based — safe to apply per file.
const TOOL_IDS = [
  "rotate",
  "grayscale",
  "watermark",
  "page-numbers",
  "header-footer",
  "bates",
  "delete-pages",
  "n-up",
  "resize",
  "sanitize",
  "flatten-pdf",
];
const TOOLS = TOOL_IDS.map((id) => getTool(id)).filter((t) => t != null);

export function BatchTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [toolId, setToolId] = useState(TOOLS[0]!.id);
  const [options, setOptions] = useState<Record<string, unknown>>({ ...TOOLS[0]!.defaultOptions });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: PDF_ACCEPT });

  function pickTool(id: string) {
    setToolId(id);
    setOptions({ ...getTool(id)!.defaultOptions });
  }

  const tool = getTool(toolId)!;

  async function run() {
    if (files.length === 0) return;
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      const parsed = tool.optionsSchema.safeParse(options);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid options");
      }
      const opts = parsed.data as Record<string, unknown>;
      const outputs: EngineFile[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Processing ${i + 1} of ${files.length}: ${files[i].name}…`);
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        const out = await runClientTool(
          tool,
          [{ name: files[i].name, data: bytes, mime: "application/pdf" }],
          opts,
        );
        outputs.push(...out);
      }
      downloadAll(outputs, `${tool.id}-batch.zip`);
      setProgress(`Done — ${outputs.length} file${outputs.length === 1 ? "" : "s"} downloaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
        }`}
      >
        <input {...getInputProps({ style: { display: "none" } })} />
        <p className="font-medium">
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} — drop more or click` : "Drop PDFs here, or click to select"}
        </p>
        <p className="mt-3"><PrivacyBadge /></p>
      </div>

      {files.length > 0 && (
        <button
          type="button"
          onClick={() => setFiles([])}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Clear files
        </button>
      )}

      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Apply this tool to every file</span>
          <select
            value={toolId}
            onChange={(e) => pickTool(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TOOLS.map((t) => (
              <option key={t!.id} value={t!.id}>{t!.name}</option>
            ))}
          </select>
        </label>
        {tool.optionFields.length > 0 && (
          <div className="mt-3">
            <OptionsForm
              fields={tool.optionFields}
              values={options}
              onChange={(key, value) => setOptions((o) => ({ ...o, [key]: value }))}
              disabled={running}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || files.length === 0}
          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
        >
          {running ? "Running…" : `Run on ${files.length || ""} file${files.length === 1 ? "" : "s"} & download zip`}
        </button>
      </div>

      {progress && <p className="text-sm text-zinc-500">{progress}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
      )}
    </div>
  );
}
