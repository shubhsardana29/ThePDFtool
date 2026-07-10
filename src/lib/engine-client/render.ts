import { baseName } from "./pages";
import type { EngineFile, EngineOptions } from "./types";

/**
 * pdfjs-dist rendering — main thread only (needs canvas). Loaded lazily so it
 * never lands in the server bundle or the initial page JS.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function loadDocument(data: Uint8Array) {
  const pdfjs = await getPdfjs();
  // pdfjs transfers the buffer to its worker — pass a copy so callers keep theirs.
  return pdfjs.getDocument({ data: data.slice() }).promise;
}

/** Public alias for UI components that need a live pdfjs document. */
export const loadPdfjsDoc = loadDocument;

export type PdfjsDocument = Awaited<ReturnType<typeof loadDocument>>;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Failed to encode JPEG")),
      "image/jpeg",
      quality,
    );
  });
}

async function renderPage(
  doc: Awaited<ReturnType<typeof loadDocument>>,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function pdfToJpg(
  files: EngineFile[],
  options: EngineOptions,
): Promise<EngineFile[]> {
  const scale = parseInt(String(options.dpi ?? "150"), 10) / 72;
  const quality = Number(options.quality ?? 0.85);
  const outputs: EngineFile[] = [];
  for (const file of files) {
    const doc = await loadDocument(file.data);
    const base = baseName(file.name);
    const pad = String(doc.numPages).length;
    for (let p = 1; p <= doc.numPages; p++) {
      const canvas = await renderPage(doc, p, scale);
      const blob = await canvasToJpeg(canvas, quality);
      outputs.push({
        name: `${base}-page-${String(p).padStart(pad, "0")}.jpg`,
        data: new Uint8Array(await blob.arrayBuffer()),
        mime: "image/jpeg",
      });
    }
    await doc.loadingTask.destroy();
  }
  return outputs;
}

/**
 * Extract a PDF's text to a .txt or Markdown file. Uses the pdfjs text layer
 * (main thread, no canvas needed). Markdown adds a document title and a
 * "## Page N" heading per page.
 */
export async function pdfToText(
  files: EngineFile[],
  options: EngineOptions,
): Promise<EngineFile[]> {
  const md = String(options.format ?? "txt") === "md";
  const outputs: EngineFile[] = [];
  for (const file of files) {
    const pages = await extractPageLines(file.data);
    const base = baseName(file.name);
    const body = md
      ? `# ${base}\n\n` +
        pages
          .map((lines, i) => `## Page ${i + 1}\n\n${lines.join("\n")}`)
          .join("\n\n")
      : pages.map((lines) => lines.join("\n")).join("\n\n");
    outputs.push({
      name: `${base}.${md ? "md" : "txt"}`,
      data: new TextEncoder().encode(body),
      mime: md ? "text/markdown" : "text/plain",
    });
  }
  return outputs;
}

/** Extract text lines per page (for the compare tool). */
export async function extractPageLines(data: Uint8Array): Promise<string[][]> {
  const doc = await loadDocument(data);
  const pages: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text runs into lines by their y position (PDF text runs are
    // fragmented; runs on the same baseline belong to one visual line).
    const byLine = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const run = { x: item.transform[4], str: item.str };
      const line = byLine.get(y);
      if (line) line.push(run);
      else byLine.set(y, [run]);
    }
    const lines = [...byLine.entries()]
      .sort((a, b) => b[0] - a[0]) // top of page first (PDF y grows upward)
      .map(([, runs]) =>
        runs
          .sort((a, b) => a.x - b.x)
          .map((r) => r.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
    pages.push(lines);
  }
  await doc.loadingTask.destroy();
  return pages;
}

/**
 * True redaction: render each page to a bitmap, paint the redaction boxes
 * onto the bitmap, and rebuild the PDF from images. The text layer is
 * discarded entirely, so redacted content is unrecoverable.
 * Boxes are in PDF points with a top-left origin (same as OverlayItem).
 */
export async function redactPdf(
  file: EngineFile,
  boxes: { page: number; x: number; y: number; w: number; h: number }[],
  dpi = 150,
): Promise<EngineFile> {
  const { PDFDocument } = await import("pdf-lib");
  const scale = dpi / 72;
  const doc = await loadDocument(file.data);
  const out = await PDFDocument.create();
  for (let p = 1; p <= doc.numPages; p++) {
    const canvas = await renderPage(doc, p, scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    for (const box of boxes) {
      if (box.page !== p - 1) continue;
      ctx.fillRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale);
    }
    const blob = await canvasToJpeg(canvas, 0.9);
    const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    // Page keeps its original point size; the bitmap is just higher-res.
    const page = out.addPage([canvas.width / scale, canvas.height / scale]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  await doc.loadingTask.destroy();
  return {
    name: `${baseName(file.name)}-redacted.pdf`,
    data: await out.save(),
    mime: "application/pdf",
  };
}

/** Render each page as a small data-URL thumbnail (for organize/preview UIs). */
export async function renderThumbnails(
  data: Uint8Array,
  thumbWidth = 160,
): Promise<string[]> {
  const doc = await loadDocument(data);
  const thumbs: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const canvas = await renderPage(doc, p, thumbWidth / base.width);
    thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
  }
  await doc.loadingTask.destroy();
  return thumbs;
}
