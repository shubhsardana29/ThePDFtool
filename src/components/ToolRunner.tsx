"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadAll, downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import {
  downloadUrl,
  runServerTool,
  type ServerJobResult,
} from "@/lib/engine-client/server-run";
import type { EngineFile } from "@/lib/engine-client/types";
import { getTool } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/types";
import { FileList } from "./FileList";
import { OptionsForm } from "./OptionsForm";
import { DropzoneArt, PrivacyBadge } from "./PrivacyBadge";

type Status = "idle" | "running" | "done";

export function ToolRunner({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);
  return <ToolRunnerInner tool={tool} />;
}

function ToolRunnerInner({ tool }: { tool: ToolDefinition }) {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState(tool.defaultOptions);
  const [status, setStatus] = useState<Status>("idle");
  const [outputs, setOutputs] = useState<EngineFile[]>([]);
  const [serverResult, setServerResult] = useState<ServerJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      setStatus("idle");
      setOutputs([]);
      setServerResult(null);
      setFiles((prev) => [...prev, ...accepted].slice(0, tool.maxFiles));
    },
    [tool.maxFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: tool.accept,
    maxFiles: tool.maxFiles,
    disabled: status === "running",
  });

  async function run() {
    setError(null);
    const parsed = tool.optionsSchema.safeParse(options);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    setStatus("running");
    try {
      const parsedOptions = parsed.data as Record<string, unknown>;
      if (tool.runtime === "server") {
        setServerResult(await runServerTool(tool.id, files, parsedOptions));
      } else {
        const engineFiles: EngineFile[] = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            data: new Uint8Array(await f.arrayBuffer()),
            mime: f.type,
          })),
        );
        setOutputs(await runClientTool(tool, engineFiles, parsedOptions));
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }

  function reset() {
    setFiles([]);
    setOutputs([]);
    setServerResult(null);
    setError(null);
    setStatus("idle");
  }

  const canRun = files.length >= tool.minFiles && status !== "running";

  return (
    <div className="flex flex-col gap-6">
      <div
        {...getRootProps()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-150 ${
          isDragActive
            ? "scale-[1.01] border-red-400 bg-red-50 dark:bg-red-950/30"
            : "border-zinc-300 bg-zinc-50/50 hover:border-red-300 hover:bg-red-50/40 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:bg-red-950/10"
        }`}
      >
        <input {...getInputProps({ style: { display: "none" } })} />
        <DropzoneArt />
        <p className="text-lg font-semibold tracking-tight">
          {isDragActive ? "Drop files here" : "Drag & drop files, or click to select"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {tool.minFiles === tool.maxFiles
            ? `${tool.maxFiles} file${tool.maxFiles > 1 ? "s" : ""}`
            : `${tool.minFiles}–${tool.maxFiles} files`}{" "}
          · {Object.values(tool.accept).flat().join(", ")}
        </p>
        <p className="mt-4">
          <PrivacyBadge server={tool.runtime === "server"} />
        </p>
      </div>

      <FileList
        files={files}
        reorderable={tool.id === "merge"}
        disabled={status === "running"}
        onRemove={(i) => setFiles((prev) => prev.filter((_, j) => j !== i))}
        onMove={(i, dir) =>
          setFiles((prev) => {
            const next = [...prev];
            [next[i], next[i + dir]] = [next[i + dir], next[i]];
            return next;
          })
        }
      />

      <OptionsForm
        fields={tool.optionFields}
        values={options}
        onChange={(key, value) => setOptions((prev) => ({ ...prev, [key]: value }))}
        disabled={status === "running"}
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="rounded-lg bg-red-500 px-7 py-2.5 font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-600 hover:shadow focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          {status === "running" ? "Processing…" : tool.name}
        </button>
        {files.length > 0 && status !== "running" && (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      {status === "done" && serverResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="mb-3 font-medium text-emerald-800 dark:text-emerald-300">
            Done — {serverResult.files.length} file
            {serverResult.files.length > 1 ? "s" : ""} ready (kept for 1 hour)
          </p>
          <ul className="mb-4 space-y-1">
            {serverResult.files.map((f) => (
              <li key={f.name}>
                <a
                  href={downloadUrl(serverResult.jobId, f.name)}
                  className="text-sm text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
                >
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={downloadUrl(serverResult.jobId)}
            className="inline-block rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {serverResult.files.length > 1 ? "Download all (.zip)" : "Download"}
          </a>
        </div>
      )}

      {status === "done" && outputs.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="mb-3 font-medium text-emerald-800 dark:text-emerald-300">
            Done — {outputs.length} file{outputs.length > 1 ? "s" : ""} ready
          </p>
          <ul className="mb-4 space-y-1">
            {outputs.map((o, i) => (
              <li key={`${o.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => downloadFile(o)}
                  className="text-sm text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => downloadAll(outputs, `${tool.id}.zip`)}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {outputs.length > 1 ? "Download all (.zip)" : "Download"}
          </button>
        </div>
      )}
    </div>
  );
}
