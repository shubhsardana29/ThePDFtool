"use client";

import { useEffect, useRef } from "react";
import type { PdfjsDocument } from "@/lib/engine-client/render";

interface Props {
  doc: PdfjsDocument;
  /** Zero-based page index. */
  pageIndex: number;
  scale: number;
  /** Reports the canvas element (for pixel sampling by the edit-text mode). */
  onCanvasRef?: (el: HTMLCanvasElement | null) => void;
}

/** Renders one PDF page into a canvas at the given scale. */
export function PageCanvas({ doc, pageIndex, scale, onCanvasRef }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    })().catch(() => {
      // render was cancelled by unmount/rescale — nothing to do
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex, scale]);

  return (
    <canvas
      ref={(el) => {
        ref.current = el;
        onCanvasRef?.(el);
      }}
      className="block h-auto w-full"
    />
  );
}
