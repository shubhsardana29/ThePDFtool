"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import {
  newItemId,
  type EllipseItem,
  type LineItem,
  type OverlayItem,
  type PathItem,
  type RectItem,
  type TextEditItem,
  type TextItem,
} from "@/lib/editor/types";
import type { DetectedLine } from "@/lib/engine-client/text-detect";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { OverlayEditor } from "./OverlayEditor";
import { PageCanvas } from "./PageCanvas";
import { PenLayer } from "./PenLayer";
import { TextEditLayer } from "./TextEditLayer";
import { usePdfLoader } from "./usePdfLoader";

type Placing =
  | { kind: "edit-text" }
  | { kind: "text" }
  | { kind: "rect" }
  | { kind: "whiteout" }
  | { kind: "highlight" }
  | { kind: "line" }
  | { kind: "arrow" }
  | { kind: "ellipse" }
  | { kind: "pen" }
  | { kind: "image"; dataUrl: string; w: number; h: number }
  | null;

const PAGE_WIDTH = 760; // CSS px each page is displayed at

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}

export function EditTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  const [items, setItems] = useState<OverlayItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing>(null);
  const [applying, setApplying] = useState(false);
  const [detected, setDetected] = useState<Map<number, DetectedLine[]>>(
    new Map(),
  );
  const [detecting, setDetecting] = useState(false);
  const [ocrPages, setOcrPages] = useState<Set<number>>(new Set());
  const imageInput = useRef<HTMLInputElement>(null);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());

  // ——— undo/redo: snapshots of `items` taken before each discrete action ———
  const itemsRef = useRef<OverlayItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    itemsRef.current = items;
    selectedIdRef.current = selectedId;
  });
  const history = useRef<OverlayItem[][]>([]);
  const future = useRef<OverlayItem[][]>([]);

  function snapshot() {
    history.current.push(itemsRef.current);
    if (history.current.length > 100) history.current.shift();
    future.current = [];
  }

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push(itemsRef.current);
    setItems(prev);
    setSelectedId(null);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(itemsRef.current);
    setItems(next);
    setSelectedId(null);
  }

  function deleteSelected() {
    const id = selectedIdRef.current;
    if (!id) return;
    snapshot();
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedId(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdRef.current) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key.startsWith("Arrow") && selectedIdRef.current) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== selectedIdRef.current || i.kind === "text-edit") return i;
            if (i.kind === "line") {
              return { ...i, x: i.x + dx, y: i.y + dy, x2: i.x2 + dx, y2: i.y2 + dy };
            }
            return { ...i, x: i.x + dx, y: i.y + dy };
          }),
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers use refs
  }, []);

  async function enterEditTextMode() {
    if (placing?.kind === "edit-text") {
      setPlacing(null);
      return;
    }
    setPlacing({ kind: "edit-text" });
    if (!pdf || detected.size > 0) return;
    setDetecting(true);
    try {
      const { detectTextLines } = await import(
        "@/lib/engine-client/text-detect"
      );
      const map = new Map<number, DetectedLine[]>();
      for (let p = 0; p < pdf.sizes.length; p++) {
        map.set(p, await detectTextLines(pdf.doc, p));
      }
      setDetected(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetecting(false);
    }
  }

  function commitTextEdit(
    line: DetectedLine,
    newText: string,
    colors: { textColor: string; bgColor: string },
  ) {
    const item: TextEditItem = {
      id: newItemId(),
      kind: "text-edit",
      page: line.page,
      x: line.x,
      y: line.y,
      w: line.w,
      h: line.h,
      baseline: line.baseline,
      originalText: line.text,
      newText,
      fontSize: line.fontSize,
      fontFamily: line.fontFamily,
      bold: line.bold,
      italic: line.italic,
      color: colors.textColor,
      bgColor: colors.bgColor,
      cssFontFamily: line.cssFontFamily,
    };
    snapshot();
    setItems((prev) => [...prev, item]);
    setSelectedId(item.id);
  }

  async function runOcr(pageIndex: number) {
    const canvas = canvases.current.get(pageIndex);
    if (!canvas || !pdf || ocrPages.has(pageIndex)) return;
    setOcrPages((prev) => new Set(prev).add(pageIndex));
    try {
      const { ocrPageCanvas } = await import("@/lib/engine-client/ocr-client");
      const size = pdf.sizes[pageIndex];
      const lines = await ocrPageCanvas(canvas, pageIndex, size.w, size.h);
      setDetected((prev) => new Map(prev).set(pageIndex, lines));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrPages((prev) => {
        const next = new Set(prev);
        next.delete(pageIndex);
        return next;
      });
    }
  }

  const onDrop = useCallback(
    (accepted: File[]) => accepted[0] && load(accepted[0]),
    [load],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function updateItem(item: OverlayItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }

  function place(page: number, x: number, y: number) {
    if (!placing || placing.kind === "edit-text" || placing.kind === "pen") return;
    const id = newItemId();
    let item: OverlayItem;
    switch (placing.kind) {
      case "text":
        item = { id, kind: "text", page, x, y, text: "Edit me", fontSize: 16, color: "#111111" };
        break;
      case "rect":
        item = { id, kind: "rect", page, x, y, w: 120, h: 60, color: "#d92626", fill: false, opacity: 1 };
        break;
      case "whiteout":
        item = { id, kind: "rect", page, x, y, w: 140, h: 24, color: "#ffffff", fill: true, opacity: 1 };
        break;
      case "highlight":
        item = { id, kind: "highlight", page, x, y, w: 160, h: 18 };
        break;
      case "line":
      case "arrow":
        item = {
          id,
          kind: "line",
          page,
          x,
          y,
          x2: x + 120,
          y2: y,
          color: "#d92626",
          strokeWidth: 2,
          arrow: placing.kind === "arrow",
        };
        break;
      case "ellipse":
        item = { id, kind: "ellipse", page, x, y, w: 110, h: 64, color: "#d92626", fill: false, opacity: 1 };
        break;
      case "image": {
        const w = 150;
        item = { id, kind: "image", page, x, y, w, h: (w * placing.h) / placing.w, dataUrl: placing.dataUrl };
        break;
      }
    }
    snapshot();
    setItems((prev) => [...prev, item]);
    setSelectedId(id);
    setPlacing(null);
  }

  function commitPen(page: number, points: { x: number; y: number }[]) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const item: PathItem = {
      id: newItemId(),
      kind: "path",
      page,
      x: minX,
      y: minY,
      w: Math.max(...xs) - minX,
      h: Math.max(...ys) - minY,
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      color: "#d92626",
      strokeWidth: 2,
    };
    snapshot();
    setItems((prev) => [...prev, item]);
  }

  function pickImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () =>
        setPlacing({ kind: "image", dataUrl, w: img.naturalWidth, h: img.naturalHeight });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const tool = getTool("edit")!;
      let [out] = await runClientTool(
        tool,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { items },
      );

      // Verification pass: confirm every edited line's original text is gone
      // from the export; survivors get re-exported with a cover patch.
      const textEdits = items.filter(
        (i): i is TextEditItem => i.kind === "text-edit" && !i.forceCover,
      );
      if (textEdits.length > 0) {
        const { verifyTextRemoval } = await import(
          "@/lib/engine-client/text-detect"
        );
        const failed = await verifyTextRemoval(out.data, textEdits);
        if (failed.size > 0) {
          const retryItems = items.map((i) =>
            failed.has(i.id) ? { ...i, forceCover: true } : i,
          );
          [out] = await runClientTool(
            tool,
            [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
            { items: retryItems },
          );
        }
      }

      downloadFile(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  function startOver() {
    reset();
    setItems([]);
    setSelectedId(null);
    setPlacing(null);
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
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <ToolbarButton
          label="✎ Edit text"
          active={placing?.kind === "edit-text"}
          onClick={enterEditTextMode}
        />
        <ToolbarButton
          label="+ Text"
          active={placing?.kind === "text"}
          onClick={() => setPlacing(placing?.kind === "text" ? null : { kind: "text" })}
        />
        <ToolbarButton
          label="+ Box"
          active={placing?.kind === "rect"}
          onClick={() => setPlacing(placing?.kind === "rect" ? null : { kind: "rect" })}
        />
        <ToolbarButton
          label="+ Highlight"
          active={placing?.kind === "highlight"}
          onClick={() => setPlacing(placing?.kind === "highlight" ? null : { kind: "highlight" })}
        />
        <ToolbarButton
          label="+ Whiteout"
          active={placing?.kind === "whiteout"}
          onClick={() => setPlacing(placing?.kind === "whiteout" ? null : { kind: "whiteout" })}
        />
        <ToolbarButton
          label="+ Line"
          active={placing?.kind === "line"}
          onClick={() => setPlacing(placing?.kind === "line" ? null : { kind: "line" })}
        />
        <ToolbarButton
          label="+ Arrow"
          active={placing?.kind === "arrow"}
          onClick={() => setPlacing(placing?.kind === "arrow" ? null : { kind: "arrow" })}
        />
        <ToolbarButton
          label="+ Ellipse"
          active={placing?.kind === "ellipse"}
          onClick={() => setPlacing(placing?.kind === "ellipse" ? null : { kind: "ellipse" })}
        />
        <ToolbarButton
          label="✏ Pen"
          active={placing?.kind === "pen"}
          onClick={() => setPlacing(placing?.kind === "pen" ? null : { kind: "pen" })}
        />
        <ToolbarButton
          label="+ Image"
          active={placing?.kind === "image"}
          onClick={() => imageInput.current?.click()}
        />
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
        />
        {placing && placing.kind !== "edit-text" && placing.kind !== "pen" && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Click on a page to place
          </span>
        )}
        {placing?.kind === "pen" && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Draw on the page
          </span>
        )}
        {placing?.kind === "edit-text" && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {detecting
              ? "Detecting text…"
              : "Click any text on the document to edit it"}
          </span>
        )}
        <span className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
        {selected?.kind === "text" && (
          <>
            <input
              type="text"
              value={selected.text}
              onChange={(e) => updateItem({ ...selected, text: e.target.value } as TextItem)}
              className="w-48 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Text content"
            />
            <input
              type="number"
              min={6}
              max={96}
              value={selected.fontSize}
              onChange={(e) =>
                updateItem({ ...selected, fontSize: e.target.valueAsNumber || 16 } as TextItem)
              }
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Font size"
            />
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateItem({ ...selected, color: e.target.value } as TextItem)}
              aria-label="Text color"
              className="h-8 w-8 cursor-pointer rounded"
            />
          </>
        )}
        {selected?.kind === "text-edit" && (
          <>
            <input
              type="text"
              value={selected.newText}
              onChange={(e) =>
                updateItem({ ...selected, newText: e.target.value } as TextEditItem)
              }
              className="w-48 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Replacement text"
            />
            <input
              type="number"
              min={4}
              max={96}
              step={0.5}
              value={selected.fontSize}
              onChange={(e) =>
                updateItem({
                  ...selected,
                  fontSize: e.target.valueAsNumber || selected.fontSize,
                } as TextEditItem)
              }
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Font size"
            />
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                updateItem({ ...selected, color: e.target.value } as TextEditItem)
              }
              aria-label="Text color"
              className="h-8 w-8 cursor-pointer rounded"
            />
          </>
        )}
        {selected?.kind === "rect" && (
          <>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateItem({ ...selected, color: e.target.value } as RectItem)}
              aria-label="Box color"
              className="h-8 w-8 cursor-pointer rounded"
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={selected.fill}
                onChange={(e) => updateItem({ ...selected, fill: e.target.checked } as RectItem)}
              />
              Fill
            </label>
          </>
        )}
        {(selected?.kind === "line" || selected?.kind === "path") && (
          <>
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                updateItem({ ...selected, color: e.target.value } as LineItem | PathItem)
              }
              aria-label="Stroke color"
              className="h-8 w-8 cursor-pointer rounded"
            />
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={selected.strokeWidth}
              onChange={(e) =>
                updateItem({
                  ...selected,
                  strokeWidth: e.target.valueAsNumber || 2,
                } as LineItem | PathItem)
              }
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Stroke width"
            />
            {selected.kind === "line" && (
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={selected.arrow}
                  onChange={(e) =>
                    updateItem({ ...selected, arrow: e.target.checked } as LineItem)
                  }
                />
                Arrow
              </label>
            )}
          </>
        )}
        {selected?.kind === "ellipse" && (
          <>
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                updateItem({ ...selected, color: e.target.value } as EllipseItem)
              }
              aria-label="Ellipse color"
              className="h-8 w-8 cursor-pointer rounded"
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={selected.fill}
                onChange={(e) =>
                  updateItem({ ...selected, fill: e.target.checked } as EllipseItem)
                }
              />
              Fill
            </label>
          </>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ↪
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {applying ? "Applying…" : "Apply & download"}
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
              <PageCanvas
                doc={pdf.doc}
                pageIndex={pageIndex}
                scale={scale}
                onCanvasRef={(el) => {
                  if (el) canvases.current.set(pageIndex, el);
                  else canvases.current.delete(pageIndex);
                }}
              />
              <OverlayEditor
                pageIndex={pageIndex}
                scale={scale}
                items={items.filter((i) => i.page === pageIndex)}
                selectedId={selectedId}
                placing={placing !== null && placing.kind !== "edit-text"}
                onSelect={setSelectedId}
                onPlace={place}
                onChange={updateItem}
                onBeforeChange={snapshot}
                onDelete={(id) => {
                  snapshot();
                  setItems((prev) => prev.filter((i) => i.id !== id));
                  setSelectedId(null);
                }}
              />
              {placing?.kind === "edit-text" && (
                <TextEditLayer
                  scale={scale}
                  lines={detected.get(pageIndex) ?? []}
                  items={items}
                  getCanvas={() => canvases.current.get(pageIndex) ?? null}
                  onCommit={commitTextEdit}
                />
              )}
              {placing?.kind === "edit-text" &&
                !detecting &&
                (detected.get(pageIndex)?.length ?? 0) === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-4">
                    <button
                      type="button"
                      onClick={() => runOcr(pageIndex)}
                      disabled={ocrPages.has(pageIndex)}
                      className="pointer-events-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
                    >
                      {ocrPages.has(pageIndex)
                        ? "Recognizing text…"
                        : "No selectable text — run OCR on this page"}
                    </button>
                  </div>
                )}
              {placing?.kind === "pen" && (
                <PenLayer
                  pageIndex={pageIndex}
                  scale={scale}
                  color="#d92626"
                  strokeWidth={2}
                  onCommit={commitPen}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
