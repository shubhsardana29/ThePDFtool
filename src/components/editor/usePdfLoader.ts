"use client";

import { useCallback, useState } from "react";
import type { PdfjsDocument } from "@/lib/engine-client/render";

export interface LoadedPdf {
  name: string;
  /** Original file bytes (kept for pdf-lib flattening). */
  data: Uint8Array;
  doc: PdfjsDocument;
  /** Per-page size in PDF points at scale 1. */
  sizes: { w: number; h: number }[];
}

export function usePdfLoader() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const { loadPdfjsDoc } = await import("@/lib/engine-client/render");
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await loadPdfjsDoc(data);
      const sizes: { w: number; h: number }[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const vp = (await doc.getPage(p)).getViewport({ scale: 1 });
        sizes.push({ w: vp.width, h: vp.height });
      }
      setPdf({ name: file.name, data, doc, sizes });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    pdf?.doc.loadingTask.destroy().catch(() => {});
    setPdf(null);
    setError(null);
  }, [pdf]);

  return { pdf, loading, error, load, reset, setError };
}
