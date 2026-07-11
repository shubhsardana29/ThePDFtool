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

interface Annot {
  id: number;
  kind: "note" | "highlight";
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
}

type Mode = "note" | "highlight";

let nextId = 1;

export function AnnotateTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  const [items, setItems] = useState<Annot[]>([]);
  const [mode, setMode] = useState<Mode>("note");
  const [applying, setApplying] = useState(false);
  const draft = useRef<{ page: number; x0: number; y0: number } | null>(null);
  const [draftRect, setDraftRect] = useState<Annot | null>(null);

  const onDrop = useCallback((accepted: File[]) => accepted[0] && load(accepted[0]), [load]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: PDF_ACCEPT, maxFiles: 1 });

  function pagePoint(e: React.PointerEvent | React.MouseEvent, scale: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function onPointerDown(e: React.PointerEvent, page: number, scale: number) {
    if (e.target !== e.currentTarget) return;
    const p = pagePoint(e, scale);
    if (mode === "note") {
      const text = window.prompt("Note text:");
      if (text) setItems((prev) => [...prev, { id: nextId++, kind: "note", page, x: p.x, y: p.y, text }]);
    } else {
      draft.current = { page, x0: p.x, y0: p.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent, scale: number) {
    const d = draft.current;
    if (!d) return;
    const p = pagePoint(e, scale);
    setDraftRect({
      id: 0,
      kind: "highlight",
      page: d.page,
      x: Math.min(d.x0, p.x),
      y: Math.min(d.y0, p.y),
      w: Math.abs(p.x - d.x0),
      h: Math.abs(p.y - d.y0),
    });
  }

  function onPointerUp() {
    const r = draftRect;
    draft.current = null;
    setDraftRect(null);
    if (r && (r.w ?? 0) > 4 && (r.h ?? 0) > 4) {
      setItems((prev) => [...prev, { ...r, id: nextId++ }]);
    }
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const payload = items.map(({ kind, page, x, y, w, h, text }) => ({ kind, page, x, y, w, h, text }));
      const [out] = await runClientTool(
        getTool("annotate")!,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { items: payload },
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
            isDragActive ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
          }`}
        >
          <input {...getInputProps({ style: { display: "none" } })} />
          <p className="text-lg font-medium">{loading ? "Loading PDF…" : "Drop a PDF here, or click to select"}</p>
          <p className="mt-4"><PrivacyBadge /></p>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        {(["note", "highlight"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === m ? "bg-blue-600 text-white" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            }`}
          >
            {m === "note" ? "💬 Note" : "🖍 Highlight"}
          </button>
        ))}
        <span className="text-xs text-blue-600 dark:text-blue-400">
          {mode === "note" ? "Click the page to drop a comment" : "Drag on the page to highlight"}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || items.length === 0}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {applying ? "Applying…" : `Apply${items.length ? ` (${items.length})` : ""} & download`}
          </button>
          <button
            type="button"
            onClick={() => { reset(); setItems([]); }}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Start over
          </button>
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
      )}

      <div className="flex flex-col items-center gap-6">
        {pdf.sizes.map((size, pageIndex) => {
          const scale = Math.min(PAGE_WIDTH, size.w * 1.5) / size.w;
          const pageItems = items.filter((i) => i.page === pageIndex);
          return (
            <div
              key={pageIndex}
              className="relative overflow-hidden rounded border border-zinc-300 shadow-sm dark:border-zinc-700"
              style={{ width: size.w * scale, height: size.h * scale }}
            >
              <PageCanvas doc={pdf.doc} pageIndex={pageIndex} scale={scale} />
              <div
                className={`absolute inset-0 ${mode === "highlight" ? "cursor-crosshair" : "cursor-copy"}`}
                onPointerDown={(e) => onPointerDown(e, pageIndex, scale)}
                onPointerMove={(e) => onPointerMove(e, scale)}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {pageItems.map((i) =>
                  i.kind === "highlight" ? (
                    <div
                      key={i.id}
                      className="group absolute"
                      style={{ left: i.x * scale, top: i.y * scale, width: (i.w ?? 0) * scale, height: (i.h ?? 0) * scale, background: "rgba(255,235,59,0.4)" }}
                    >
                      <button
                        type="button"
                        aria-label="Remove highlight"
                        onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
                        className="absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      key={i.id}
                      type="button"
                      title={i.text}
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
                      className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-xs shadow ring-1 ring-amber-500 hover:bg-red-400"
                      style={{ left: i.x * scale, top: i.y * scale - 24 }}
                    >💬</button>
                  ),
                )}
                {draftRect && draftRect.page === pageIndex && (
                  <div
                    className="absolute border border-amber-500"
                    style={{ left: draftRect.x * scale, top: draftRect.y * scale, width: (draftRect.w ?? 0) * scale, height: (draftRect.h ?? 0) * scale, background: "rgba(255,235,59,0.4)" }}
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
