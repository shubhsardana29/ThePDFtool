"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";

interface PageThumb {
  /** Zero-based index of this page in the original document. */
  origIndex: number;
  thumb: string;
}

export function OrganizeTool() {
  const tool = getTool("organize")!;
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [busy, setBusy] = useState<"loading" | "applying" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setError(null);
    setFile(f);
    setBusy("loading");
    try {
      const { renderThumbnails } = await import("@/lib/engine-client/render");
      const data = new Uint8Array(await f.arrayBuffer());
      const thumbs = await renderThumbnails(data);
      setPages(thumbs.map((thumb, i) => ({ origIndex: i, thumb })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFile(null);
    } finally {
      setBusy(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
    disabled: busy !== null,
  });

  function move(index: number, dir: -1 | 1) {
    setPages((prev) => {
      const next = [...prev];
      [next[index], next[index + dir]] = [next[index + dir], next[index]];
      return next;
    });
  }

  async function apply() {
    if (!file) return;
    setError(null);
    setBusy("applying");
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const outputs = await runClientTool(
        tool,
        [{ name: file.name, data, mime: "application/pdf" }],
        { order: pages.map((p) => p.origIndex) },
      );
      downloadFile(outputs[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (!file || pages.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive
              ? "border-red-400 bg-red-50 dark:bg-red-950/30"
              : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
          }`}
        >
          <input {...getInputProps({ style: { display: "none" } })} />
          <p className="text-lg font-medium">
            {busy === "loading"
              ? "Rendering page thumbnails…"
              : "Drop a PDF here, or click to select"}
          </p>
          <p className="mt-4">
            <PrivacyBadge />
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pages.map((page, i) => (
          <div
            key={page.origIndex}
            className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail */}
            <img
              src={page.thumb}
              alt={`Page ${page.origIndex + 1}`}
              className="w-full rounded border border-zinc-100 dark:border-zinc-800"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>p.{page.origIndex + 1}</span>
              <span className="flex gap-0.5">
                <button
                  type="button"
                  aria-label="Move earlier"
                  disabled={i === 0 || busy !== null}
                  onClick={() => move(i, -1)}
                  className="rounded px-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Move later"
                  disabled={i === pages.length - 1 || busy !== null}
                  onClick={() => move(i, 1)}
                  className="rounded px-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label="Delete page"
                  disabled={busy !== null}
                  onClick={() =>
                    setPages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="rounded px-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  ✕
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={apply}
          disabled={busy !== null || pages.length === 0}
          className="rounded-lg bg-red-500 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "applying" ? "Applying…" : "Apply & download"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setFile(null);
            setPages([]);
            setError(null);
          }}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
