"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { PageCanvas } from "./PageCanvas";
import { usePdfLoader } from "./usePdfLoader";

const PAGE_WIDTH = 760;

interface Box {
  id: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Drawing {
  page: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function RedactTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [applying, setApplying] = useState(false);
  const nextId = useRef(1);

  const onDrop = useCallback(
    (accepted: File[]) => accepted[0] && load(accepted[0]),
    [load],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  function pagePos(e: React.PointerEvent, scale: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  function down(e: React.PointerEvent, page: number, scale: number) {
    const { x, y } = pagePos(e, scale);
    setDrawing({ page, startX: x, startY: y, x, y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent, page: number, scale: number) {
    if (!drawing || drawing.page !== page) return;
    const { x, y } = pagePos(e, scale);
    setDrawing({
      ...drawing,
      x: Math.min(x, drawing.startX),
      y: Math.min(y, drawing.startY),
      w: Math.abs(x - drawing.startX),
      h: Math.abs(y - drawing.startY),
    });
  }

  function up() {
    if (drawing && drawing.w > 4 && drawing.h > 4) {
      setBoxes((prev) => [
        ...prev,
        { id: nextId.current++, page: drawing.page, x: drawing.x, y: drawing.y, w: drawing.w, h: drawing.h },
      ]);
    }
    setDrawing(null);
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const { redactPdf } = await import("@/lib/engine-client/render");
      const out = await redactPdf(
        { name: pdf.name, data: pdf.data, mime: "application/pdf" },
        boxes,
      );
      downloadFile(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  function startOver() {
    reset();
    setBoxes([]);
    setDrawing(null);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Drag over the content you want to black out. {boxes.length} area
          {boxes.length === 1 ? "" : "s"} marked.
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || boxes.length === 0}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {applying ? "Redacting…" : "Redact & download"}
          </button>
          <button
            type="button"
            onClick={startOver}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Start over
          </button>
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        Redacted pages are converted to images so the text underneath is
        permanently removed — the output has no selectable text.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-6">
        {pdf.sizes.map((size, pageIndex) => {
          const scale = Math.min(PAGE_WIDTH, size.w * 1.5) / size.w;
          return (
            <div
              key={pageIndex}
              className="relative overflow-hidden rounded border border-zinc-300 shadow-sm dark:border-zinc-700"
              style={{ width: size.w * scale, height: size.h * scale }}
            >
              <PageCanvas doc={pdf.doc} pageIndex={pageIndex} scale={scale} />
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={(e) => down(e, pageIndex, scale)}
                onPointerMove={(e) => move(e, pageIndex, scale)}
                onPointerUp={up}
                onPointerCancel={up}
              >
                {boxes
                  .filter((b) => b.page === pageIndex)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="group absolute bg-black"
                      style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
                    >
                      <button
                        type="button"
                        aria-label="Remove redaction"
                        className="absolute -top-3 -right-3 hidden h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow group-hover:flex"
                        onClick={() => setBoxes((prev) => prev.filter((x) => x.id !== b.id))}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                {drawing && drawing.page === pageIndex && (
                  <div
                    className="absolute bg-black/70"
                    style={{
                      left: drawing.x * scale,
                      top: drawing.y * scale,
                      width: drawing.w * scale,
                      height: drawing.h * scale,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
