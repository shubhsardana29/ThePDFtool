"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import { newItemId, type OverlayItem } from "@/lib/editor/types";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { OverlayEditor } from "./OverlayEditor";
import { PageCanvas } from "./PageCanvas";
import { SignaturePad } from "./SignaturePad";
import { usePdfLoader } from "./usePdfLoader";

const PAGE_WIDTH = 760;

interface Signature {
  dataUrl: string;
  w: number;
  h: number;
}

export function SignTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [items, setItems] = useState<OverlayItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => accepted[0] && load(accepted[0]),
    [load],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  function place(page: number, x: number, y: number) {
    if (!signature) return;
    const w = 160;
    const h = (w * signature.h) / signature.w;
    const id = newItemId();
    setItems((prev) => [
      ...prev,
      // center the stamp on the click point
      { id, kind: "image", page, x: x - w / 2, y: y - h / 2, w, h, dataUrl: signature.dataUrl },
    ]);
    setSelectedId(id);
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const tool = getTool("sign")!;
      const [out] = await runClientTool(
        tool,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { items, suffix: "signed" },
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
    setSignature(null);
    setItems([]);
    setSelectedId(null);
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
      {!signature ? (
        <>
          <p className="text-sm text-zinc-500">
            Create your signature, then click anywhere on the document to place it.
          </p>
          <SignaturePad
            onCreate={(dataUrl, w, h) => setSignature({ dataUrl, w, h })}
          />
        </>
      ) : (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
          <img src={signature.dataUrl} alt="signature" className="h-10 w-auto" />
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Click on the document to place{items.length > 0 ? " again" : ""}
          </span>
          <button
            type="button"
            onClick={() => setSignature(null)}
            className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            New signature
          </button>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={applying || items.length === 0}
              className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {applying ? "Signing…" : "Sign & download"}
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
      )}

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
                placing={signature !== null}
                onSelect={setSelectedId}
                onPlace={place}
                onChange={(item) =>
                  setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
                }
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
