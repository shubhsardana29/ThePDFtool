"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import {
  newItemId,
  type OverlayItem,
  type RectItem,
  type TextItem,
} from "@/lib/editor/types";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { OverlayEditor } from "./OverlayEditor";
import { PageCanvas } from "./PageCanvas";
import { usePdfLoader } from "./usePdfLoader";

type Placing =
  | { kind: "text" }
  | { kind: "rect" }
  | { kind: "highlight" }
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
  const imageInput = useRef<HTMLInputElement>(null);

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
    if (!placing) return;
    const id = newItemId();
    let item: OverlayItem;
    switch (placing.kind) {
      case "text":
        item = { id, kind: "text", page, x, y, text: "Edit me", fontSize: 16, color: "#111111" };
        break;
      case "rect":
        item = { id, kind: "rect", page, x, y, w: 120, h: 60, color: "#d92626", fill: false, opacity: 1 };
        break;
      case "highlight":
        item = { id, kind: "highlight", page, x, y, w: 160, h: 18 };
        break;
      case "image": {
        const w = 150;
        item = { id, kind: "image", page, x, y, w, h: (w * placing.h) / placing.w, dataUrl: placing.dataUrl };
        break;
      }
    }
    setItems((prev) => [...prev, item]);
    setSelectedId(id);
    setPlacing(null);
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
      const [out] = await runClientTool(
        tool,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { items },
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
        {placing && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Click on a page to place
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
        <span className="ml-auto flex items-center gap-2">
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
              <PageCanvas doc={pdf.doc} pageIndex={pageIndex} scale={scale} />
              <OverlayEditor
                pageIndex={pageIndex}
                scale={scale}
                items={items.filter((i) => i.page === pageIndex)}
                selectedId={selectedId}
                placing={placing !== null}
                onSelect={setSelectedId}
                onPlace={place}
                onChange={updateItem}
                onDelete={(id) => {
                  setItems((prev) => prev.filter((i) => i.id !== id));
                  setSelectedId(null);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
