/**
 * In-browser OCR for the editor, via tesseract.js. Recognizes the text on a
 * rendered page canvas and returns editable lines in the same DISPLAYED
 * top-left point space the editor uses, so scanned/image-only PDFs become
 * editable (edits are applied through the cover-and-redraw path, since there's
 * no content-stream text to remove).
 *
 * All assets (worker, wasm core, English data) are self-hosted under
 * /public/tesseract — no CDN calls, so the privacy promise holds.
 */
import type { DetectedLine } from "./text-detect";

interface TessLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = await import("tesseract.js");
    workerPromise = createWorker("eng", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
      langPath: "/tesseract/",
    });
  }
  return workerPromise;
}

/** Recognize the text on a rendered page canvas as editor lines. */
export async function ocrPageCanvas(
  canvas: HTMLCanvasElement,
  page: number,
  displayedW: number,
  displayedH: number,
): Promise<DetectedLine[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });

  // Flatten blocks → paragraphs → lines. tesseract bboxes are canvas pixels.
  const lines: TessLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = line.text.replace(/\s+/g, " ").trim();
        if (text) lines.push({ text, bbox: line.bbox });
      }
    }
  }

  const sx = displayedW / canvas.width;
  const sy = displayedH / canvas.height;
  return lines.map((l): DetectedLine => {
    const x = l.bbox.x0 * sx;
    const y = l.bbox.y0 * sy;
    const h = (l.bbox.y1 - l.bbox.y0) * sy;
    return {
      page,
      text: l.text,
      x,
      y,
      w: (l.bbox.x1 - l.bbox.x0) * sx,
      h,
      baseline: l.bbox.y1 * sy,
      fontSize: h * 0.85,
      fontFamily: "sans",
      bold: false,
      italic: false,
      cssFontFamily: "sans-serif",
    };
  });
}

/** Free the OCR worker (call when leaving the tool). */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
