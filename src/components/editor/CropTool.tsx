"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { PageCanvas } from "./PageCanvas";
import { usePdfLoader } from "./usePdfLoader";

const PAGE_WIDTH = 760;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Drag {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  orig: Box;
}

export function CropTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  // null until the user first drags — until then we show a default 10% inset
  // derived from page 1 (computed in render, no effect needed).
  const [box, setBox] = useState<Box | null>(null);
  const [applying, setApplying] = useState(false);
  const drag = useRef<Drag | null>(null);

  const activeBox: Box | null = pdf
    ? (box ?? {
        x: pdf.sizes[0].w * 0.1,
        y: pdf.sizes[0].h * 0.1,
        w: pdf.sizes[0].w * 0.8,
        h: pdf.sizes[0].h * 0.8,
      })
    : null;

  const onDrop = useCallback((accepted: File[]) => accepted[0] && load(accepted[0]), [load]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  const scale = pdf ? Math.min(PAGE_WIDTH, pdf.sizes[0].w * 1.5) / pdf.sizes[0].w : 1;

  function begin(e: React.PointerEvent, mode: Drag["mode"]) {
    e.stopPropagation();
    if (!activeBox) return;
    drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...activeBox } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !pdf) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const { w: pw, h: ph } = pdf.sizes[0];
    if (d.mode === "move") {
      setBox({
        ...d.orig,
        x: Math.min(Math.max(0, d.orig.x + dx), pw - d.orig.w),
        y: Math.min(Math.max(0, d.orig.y + dy), ph - d.orig.h),
      });
    } else {
      setBox({
        ...d.orig,
        w: Math.min(Math.max(20, d.orig.w + dx), pw - d.orig.x),
        h: Math.min(Math.max(20, d.orig.h + dy), ph - d.orig.y),
      });
    }
  }

  function end() {
    drag.current = null;
  }

  async function apply() {
    if (!pdf || !activeBox) return;
    setApplying(true);
    setError(null);
    try {
      const [out] = await runClientTool(
        getTool("crop")!,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { box: activeBox },
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
            {loading ? "Loading PDF…" : "Drop a PDF here, or click to select"}
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

  const size = pdf.sizes[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          Drag the box to crop. Applied to all {pdf.sizes.length} page
          {pdf.sizes.length === 1 ? "" : "s"}.
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {applying ? "Cropping…" : "Apply & download"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setBox(null);
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

      <div className="flex flex-col items-center">
        <div
          className="relative overflow-hidden rounded border border-zinc-300 shadow-sm dark:border-zinc-700"
          style={{ width: size.w * scale, height: size.h * scale }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <PageCanvas doc={pdf.doc} pageIndex={0} scale={scale} />
          {activeBox && (
            <div
              className="absolute cursor-move touch-none border-2 border-red-500"
              style={{
                left: activeBox.x * scale,
                top: activeBox.y * scale,
                width: activeBox.w * scale,
                height: activeBox.h * scale,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
              onPointerDown={(e) => begin(e, "move")}
            >
              <div
                aria-label="Resize crop box"
                className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-white bg-red-500"
                onPointerDown={(e) => begin(e, "resize")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
