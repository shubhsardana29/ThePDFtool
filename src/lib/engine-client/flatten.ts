import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { hexToRgb, type OverlayItem } from "@/lib/editor/types";
import { baseName } from "./pages";
import type { EngineFile, EngineOp } from "./types";

const HIGHLIGHT = { color: rgb(1, 0.9, 0.2), opacity: 0.4 };

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; isPng: boolean } {
  const [head, body] = dataUrl.split(",", 2);
  if (!head || body === undefined) throw new Error("Invalid image data");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, isPng: head.includes("image/png") };
}

function drawText(page: PDFPage, font: PDFFont, item: Extract<OverlayItem, { kind: "text" }>) {
  const { r, g, b } = hexToRgb(item.color);
  const pageH = page.getHeight();
  const lineHeight = item.fontSize * 1.25;
  const lines = item.text.split("\n");
  lines.forEach((line, i) => {
    if (!line) return;
    // item.y is the top of the text block; drawText wants the baseline.
    const baselineFromTop = item.y + i * lineHeight + item.fontSize * 0.85;
    page.drawText(line, {
      x: item.x,
      y: pageH - baselineFromTop,
      size: item.fontSize,
      font,
      color: rgb(r, g, b),
    });
  });
}

/**
 * Stamp overlay items onto the PDF. options.items is an OverlayItem[] — this
 * runs inside the worker, so everything is plain serializable data.
 */
export const flatten: EngineOp = async ([file], options) => {
  const items = (options.items ?? []) as OverlayItem[];
  const doc = await PDFDocument.load(file.data);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const item of items) {
    const page = pages[item.page];
    if (!page) continue;
    const pageH = page.getHeight();
    switch (item.kind) {
      case "text":
        drawText(page, font, item);
        break;
      case "rect": {
        const { r, g, b } = hexToRgb(item.color);
        page.drawRectangle({
          x: item.x,
          y: pageH - item.y - item.h,
          width: item.w,
          height: item.h,
          ...(item.fill
            ? { color: rgb(r, g, b), opacity: item.opacity }
            : { borderColor: rgb(r, g, b), borderWidth: 2, borderOpacity: item.opacity }),
        });
        break;
      }
      case "highlight":
        page.drawRectangle({
          x: item.x,
          y: pageH - item.y - item.h,
          width: item.w,
          height: item.h,
          color: HIGHLIGHT.color,
          opacity: HIGHLIGHT.opacity,
        });
        break;
      case "image": {
        const { bytes, isPng } = dataUrlToBytes(item.dataUrl);
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        page.drawImage(image, {
          x: item.x,
          y: pageH - item.y - item.h,
          width: item.w,
          height: item.h,
        });
        break;
      }
    }
  }

  const suffix = typeof options.suffix === "string" ? options.suffix : "edited";
  const out: EngineFile = {
    name: `${baseName(file.name)}-${suffix}.pdf`,
    data: await doc.save(),
    mime: "application/pdf",
  };
  return [out];
};
