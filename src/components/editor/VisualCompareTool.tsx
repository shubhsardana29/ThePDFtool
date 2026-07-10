"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { changedPercent, diffPixels } from "@/lib/engine-client/pixel-diff";
import { PDF_ACCEPT } from "@/lib/tools/types";

interface PageResult {
  page: number;
  changed: boolean;
  percent: number;
  note?: string;
  diffUrl?: string;
}

function Drop({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  const onDrop = useCallback((accepted: File[]) => accepted[0] && onFile(accepted[0]), [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: PDF_ACCEPT, maxFiles: 1 });
  return (
    <div
      {...getRootProps()}
      className={`flex-1 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        isDragActive ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
      }`}
    >
      <input {...getInputProps({ style: { display: "none" } })} />
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-medium">{file ? file.name : "Drop or click"}</p>
    </div>
  );
}

async function renderPage(
  doc: Awaited<ReturnType<typeof import("@/lib/engine-client/render").loadPdfjsDoc>>,
  pageNum: number,
  targetWidth: number,
): Promise<{ img: ImageData; w: number; h: number } | null> {
  if (pageNum > doc.numPages) return null;
  const page = await doc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, targetWidth / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { img: ctx.getImageData(0, 0, canvas.width, canvas.height), w: canvas.width, h: canvas.height };
}

export function VisualCompareTool() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [results, setResults] = useState<PageResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!fileA || !fileB) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const { loadPdfjsDoc } = await import("@/lib/engine-client/render");
      const [docA, docB] = await Promise.all([
        loadPdfjsDoc(new Uint8Array(await fileA.arrayBuffer())),
        loadPdfjsDoc(new Uint8Array(await fileB.arrayBuffer())),
      ]);
      const pageCount = Math.max(docA.numPages, docB.numPages);
      const out: PageResult[] = [];
      for (let p = 1; p <= pageCount; p++) {
        const [a, b] = await Promise.all([renderPage(docA, p, 700), renderPage(docB, p, 700)]);
        if (!a || !b) {
          out.push({ page: p, changed: true, percent: 100, note: a ? "Only in original" : "Only in modified" });
          continue;
        }
        if (a.w !== b.w || a.h !== b.h) {
          out.push({ page: p, changed: true, percent: 100, note: "Page size differs" });
          continue;
        }
        const diff = diffPixels(a.img.data, b.img.data, a.w, a.h);
        const percent = changedPercent(diff);
        let diffUrl: string | undefined;
        if (diff.changed > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = a.w;
          canvas.height = a.h;
          canvas
            .getContext("2d")!
            .putImageData(new ImageData(diff.out as Uint8ClampedArray<ArrayBuffer>, a.w, a.h), 0, 0);
          diffUrl = canvas.toDataURL("image/png");
        }
        out.push({ page: p, changed: diff.changed > 0, percent, diffUrl });
      }
      await Promise.all([docA.loadingTask.destroy(), docB.loadingTask.destroy()]);
      setResults(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const changed = results?.filter((r) => r.changed) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Drop label="Original PDF" file={fileA} onFile={setFileA} />
        <Drop label="Modified PDF" file={fileB} onFile={setFileB} />
      </div>
      <p className="text-center text-xs text-zinc-400">
        Pages are rendered and compared pixel-by-pixel in your browser — files are never uploaded.
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

      {results && (
        <div className="flex flex-col gap-4">
          <p className="font-medium">
            {changed.length === 0
              ? "No visual differences found."
              : `Visual differences on ${changed.length} of ${results.length} page(s):`}
          </p>
          {changed.map((r) => (
            <div key={r.page} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <p className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                <span>Page {r.page}</span>
                <span className="font-normal text-zinc-500">{r.note ?? `${r.percent}% of pixels changed`}</span>
              </p>
              {r.diffUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL diff
                <img src={r.diffUrl} alt={`Page ${r.page} diff`} className="w-full" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
