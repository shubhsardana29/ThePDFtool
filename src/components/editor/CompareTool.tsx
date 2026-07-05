"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { diffLines, type DiffLine } from "@/lib/editor/diff";
import { PDF_ACCEPT } from "@/lib/tools/types";

interface PageDiff {
  page: number;
  lines: DiffLine[];
  changed: boolean;
}

function Drop({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => accepted[0] && onFile(accepted[0]),
    [onFile],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });
  return (
    <div
      {...getRootProps()}
      className={`flex-1 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        isDragActive
          ? "border-red-400 bg-red-50 dark:bg-red-950/30"
          : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
      }`}
    >
      <input {...getInputProps({ style: { display: "none" } })} />
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-medium">{file ? file.name : "Drop or click"}</p>
    </div>
  );
}

export function CompareTool() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<PageDiff[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!fileA || !fileB) return;
    setBusy(true);
    setError(null);
    setDiffs(null);
    try {
      const { extractPageLines } = await import("@/lib/engine-client/render");
      const [pagesA, pagesB] = await Promise.all([
        extractPageLines(new Uint8Array(await fileA.arrayBuffer())),
        extractPageLines(new Uint8Array(await fileB.arrayBuffer())),
      ]);
      const pageCount = Math.max(pagesA.length, pagesB.length);
      const result: PageDiff[] = [];
      for (let p = 0; p < pageCount; p++) {
        const lines = diffLines(pagesA[p] ?? [], pagesB[p] ?? []);
        result.push({ page: p, lines, changed: lines.some((l) => l.type !== "same") });
      }
      setDiffs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const changedPages = diffs?.filter((d) => d.changed) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Drop label="Original PDF" file={fileA} onFile={setFileA} />
        <Drop label="Modified PDF" file={fileB} onFile={setFileB} />
      </div>
      <p className="text-center text-xs text-zinc-400">
        Text is compared entirely in your browser — files are never uploaded.
      </p>

      <button
        type="button"
        onClick={compare}
        disabled={!fileA || !fileB || busy}
        className="w-fit rounded-lg bg-red-500 px-6 py-2.5 font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Comparing…" : "Compare"}
      </button>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      {diffs && (
        <div className="flex flex-col gap-4">
          <p className="font-medium">
            {changedPages.length === 0
              ? "No text differences found."
              : `Differences on ${changedPages.length} of ${diffs.length} page(s):`}
          </p>
          {changedPages.map((d) => (
            <div
              key={d.page}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <p className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                Page {d.page + 1}
              </p>
              <div className="max-h-96 overflow-y-auto p-2 font-mono text-xs leading-5">
                {d.lines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === "added"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : line.type === "removed"
                          ? "bg-red-50 text-red-700 line-through dark:bg-red-950/40 dark:text-red-300"
                          : "text-zinc-500"
                    }
                  >
                    <span className="mr-2 inline-block w-3 select-none text-zinc-400">
                      {line.type === "added" ? "+" : line.type === "removed" ? "−" : ""}
                    </span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
