"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import type { DetectedImage } from "@/lib/engine-client/image-detect";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";

interface Loaded {
  name: string;
  data: Uint8Array;
}

export function ReplaceImageTool() {
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [images, setImages] = useState<DetectedImage[]>([]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [detected, setDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const { detectImages } = await import("@/lib/engine-client/image-detect");
      setImages(await detectImages(data));
      setPdf({ name: file.name, data });
      setDetected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((accepted: File[]) => accepted[0] && load(accepted[0]), [load]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  function chooseReplacement(file: File) {
    const id = pickFor.current;
    if (!id) return;
    const reader = new FileReader();
    reader.onload = () => setReplacements((r) => ({ ...r, [id]: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const payload = images
        .filter((img) => replacements[img.id])
        .map((img) => ({ sites: img.sites, dataUrl: replacements[img.id] }));
      const [out] = await runClientTool(
        getTool("replace-image")!,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { replacements: payload },
      );
      downloadFile(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  if (!pdf) {
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
            {loading ? "Scanning for images…" : "Drop a PDF here, or click to select"}
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

  const replacedCount = images.filter((i) => replacements[i.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          {detected && images.length === 0
            ? "No replaceable images found in this PDF."
            : `${images.length} image${images.length === 1 ? "" : "s"} found — pick one to replace.`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || replacedCount === 0}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {applying ? "Applying…" : `Apply${replacedCount ? ` (${replacedCount})` : ""} & download`}
          </button>
          <button
            type="button"
            onClick={() => {
              setPdf(null);
              setImages([]);
              setReplacements({});
              setDetected(false);
              setError(null);
            }}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Start over
          </button>
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) chooseReplacement(e.target.files[0]);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => {
          const repl = replacements[img.id];
          return (
            <div
              key={img.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
                <img
                  src={repl ?? img.previewDataUrl}
                  alt="embedded"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="text-xs text-zinc-500">
                {img.width}×{img.height}px
                {img.sites.length > 1 ? ` · used ${img.sites.length}×` : ""}
                {repl ? " · replaced" : ""}
              </div>
              <button
                type="button"
                onClick={() => {
                  pickFor.current = img.id;
                  fileInput.current?.click();
                }}
                className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {repl ? "Choose different" : "Replace…"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
