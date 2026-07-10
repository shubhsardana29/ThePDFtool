"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import { newItemId, type FormFieldItem } from "@/lib/editor/types";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { FormLayer } from "./FormLayer";
import { PageCanvas } from "./PageCanvas";
import { usePdfLoader } from "./usePdfLoader";

const PAGE_WIDTH = 760;

export function FillFormTool() {
  const { pdf, loading, error, load, reset, setError } = usePdfLoader();
  const [items, setItems] = useState<FormFieldItem[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [flattenForms, setFlattenForms] = useState(false);
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

  // Detect every page's form fields once the document is loaded. All state
  // updates happen inside the async task (never synchronously in the effect
  // body) so we don't trigger cascading renders.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      setDetecting(true);
      setDetected(false);
      try {
        const { detectFormFields } = await import(
          "@/lib/engine-client/form-detect"
        );
        const found: FormFieldItem[] = [];
        for (let p = 0; p < pdf.sizes.length; p++) {
          const fields = await detectFormFields(pdf.doc, p);
          for (const f of fields) {
            found.push({ id: newItemId(), kind: "form-field", ...f });
          }
        }
        if (cancelled) return;
        setItems(found);
        setDetected(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setError is stable
  }, [pdf]);

  function setFieldValue(id: string, value: string | boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, value } : i)),
    );
  }

  function selectRadio(fieldName: string, exportValue: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.fieldName === fieldName ? { ...i, value: exportValue } : i,
      ),
    );
  }

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const tool = getTool("fill-form")!;
      const [out] = await runClientTool(
        tool,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { items, flattenForms, suffix: "filled" },
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
    setDetected(false);
    setFlattenForms(false);
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
            {loading ? "Loading PDF…" : "Drop a PDF form here, or click to select"}
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

  const noFields = detected && items.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          {detecting
            ? "Scanning for form fields…"
            : noFields
              ? "No fillable fields found in this PDF."
              : `${items.length} field${items.length === 1 ? "" : "s"} found — fill them below.`}
        </span>
        {!noFields && !detecting && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={flattenForms}
              onChange={(e) => setFlattenForms(e.target.checked)}
              className="accent-blue-600"
            />
            Flatten form (make fields non-editable)
          </label>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || detecting || noFields}
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
              <FormLayer
                scale={scale}
                fields={items.filter((i) => i.page === pageIndex)}
                onChange={setFieldValue}
                onSelectRadio={selectRadio}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
