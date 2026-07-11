"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import type { EngineFile } from "@/lib/engine-client/types";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { OptionsForm } from "@/components/OptionsForm";

// Client tools that take one PDF and produce one PDF (no custom UI, no multi
// output) — the ones that can be chained end to end.
const STEP_IDS = [
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
const STEP_TOOLS = STEP_IDS.map((id) => getTool(id)).filter((t) => t != null);

interface Step {
  key: number;
  toolId: string;
  options: Record<string, unknown>;
}

let nextKey = 1;

function makeStep(toolId: string): Step {
  const tool = getTool(toolId)!;
  return { key: nextKey++, toolId, options: { ...tool.defaultOptions } };
}

interface Loaded {
  name: string;
  data: Uint8Array;
}

export function PipelineTool() {
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      setPdf({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
    } finally {
      setLoading(false);
    }
  }, []);
  const onDrop = useCallback((accepted: File[]) => accepted[0] && load(accepted[0]), [load]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: PDF_ACCEPT, maxFiles: 1 });

  function updateStep(key: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function setStepTool(key: number, toolId: string) {
    updateStep(key, { toolId, options: { ...getTool(toolId)!.defaultOptions } });
  }
  function move(key: number, dir: -1 | 1) {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function run() {
    if (!pdf || steps.length === 0) return;
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      let files: EngineFile[] = [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }];
      for (let i = 0; i < steps.length; i++) {
        const tool = getTool(steps[i].toolId)!;
        const parsed = tool.optionsSchema.safeParse(steps[i].options);
        if (!parsed.success) {
          throw new Error(`Step ${i + 1} (${tool.name}): ${parsed.error.issues[0]?.message ?? "invalid options"}`);
        }
        setProgress(`Step ${i + 1} of ${steps.length}: ${tool.name}…`);
        files = await runClientTool(tool, files, parsed.data as Record<string, unknown>);
        if (files.length !== 1) {
          throw new Error(`Step ${i + 1} (${tool.name}) did not produce a single PDF.`);
        }
      }
      downloadFile(files[0]);
      setProgress("Done — downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    } finally {
      setRunning(false);
    }
  }

  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
          }`}
        >
          <input {...getInputProps({ style: { display: "none" } })} />
          <p className="text-lg font-medium">{loading ? "Loading PDF…" : "Drop a PDF here, or click to select"}</p>
          <p className="mt-4"><PrivacyBadge /></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Chain steps to run on{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{pdf.name}</span> in order —
        each step&rsquo;s output feeds the next. Everything runs in your browser.
      </p>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const tool = getTool(step.toolId)!;
          return (
            <div key={step.key} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold dark:bg-zinc-700">
                  {i + 1}
                </span>
                <select
                  value={step.toolId}
                  onChange={(e) => setStepTool(step.key, e.target.value)}
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {STEP_TOOLS.map((t) => (
                    <option key={t!.id} value={t!.id}>{t!.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => move(step.key, -1)} disabled={i === 0} aria-label="Move up" className="rounded px-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">↑</button>
                <button type="button" onClick={() => move(step.key, 1)} disabled={i === steps.length - 1} aria-label="Move down" className="rounded px-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">↓</button>
                <button type="button" onClick={() => setSteps((p) => p.filter((s) => s.key !== step.key))} aria-label="Remove step" className="rounded px-1.5 text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50">✕</button>
              </div>
              {tool.optionFields.length > 0 && (
                <div className="mt-3 pl-8">
                  <OptionsForm
                    fields={tool.optionFields}
                    values={step.options}
                    onChange={(key, value) => updateStep(step.key, { options: { ...step.options, [key]: value } })}
                    disabled={running}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSteps((p) => [...p, makeStep(STEP_TOOLS[0]!.id)])}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          + Add step
        </button>
        <button
          type="button"
          onClick={run}
          disabled={running || steps.length === 0}
          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
        >
          {running ? "Running…" : "Run pipeline & download"}
        </button>
        <button
          type="button"
          onClick={() => { setPdf(null); setSteps([]); setError(null); setProgress(null); }}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Start over
        </button>
      </div>

      {progress && <p className="text-sm text-zinc-500">{progress}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
      )}
    </div>
  );
}
