import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  hexToRgb,
  type OverlayItem,
  type TextEditItem,
} from "@/lib/editor/types";
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
 * Remove the original text of every text-edit item from its page's content
 * stream. Items whose text can't be located (e.g. inside a Form XObject) or
 * that are flagged forceCover are returned for the cover fallback.
 */
async function removeEditedText(
  doc: PDFDocument,
  pages: PDFPage[],
  textEdits: TextEditItem[],
): Promise<Set<string>> {
  const coverIds = new Set<string>();
  const { removeTextInRegions } = await import("./content-edit");
  const byPage = new Map<number, TextEditItem[]>();
  for (const item of textEdits) {
    const list = byPage.get(item.page) ?? [];
    list.push(item);
    byPage.set(item.page, list);
  }
  for (const [pageIdx, pageItems] of byPage) {
    const page = pages[pageIdx];
    if (!page) continue;
    const removable = pageItems.filter((i) => !i.forceCover);
    for (const item of pageItems) if (item.forceCover) coverIds.add(item.id);
    if (removable.length === 0) continue;
    try {
      const { removed, invisible } = removeTextInRegions(
        doc,
        page,
        removable.map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h, baseline: i.baseline })),
      );
      removable.forEach((item, i) => {
        if (removed[i] === 0 && invisible[i] === 0) coverIds.add(item.id);
      });
    } catch (err) {
      // Malformed stream — never fail the export; cover every line instead.
      console.error(`text removal failed on page ${pageIdx + 1}:`, err);
      for (const item of removable) coverIds.add(item.id);
    }
  }
  return coverIds;
}

/** Embed the Liberation variant each text edit needs (once per variant). */
async function embedEditFonts(
  doc: PDFDocument,
  textEdits: TextEditItem[],
  fallback: PDFFont,
): Promise<Map<string, PDFFont>> {
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  doc.registerFontkit(fontkit);
  const { embedVariant, variantKey } = await import("./font-match");
  const byVariant = new Map<string, PDFFont>();
  const byItem = new Map<string, PDFFont>();
  for (const item of textEdits) {
    const key = variantKey(item);
    if (!byVariant.has(key)) {
      try {
        byVariant.set(key, await embedVariant(doc, item));
      } catch (err) {
        console.error(`font ${key} unavailable, using Helvetica:`, err);
        byVariant.set(key, fallback);
      }
    }
    byItem.set(item.id, byVariant.get(key)!);
  }
  return byItem;
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

  // Inline text edits: remove originals first (before any drawing appends
  // content), then draw replacements in the loop below.
  const textEdits = items.filter(
    (i): i is TextEditItem => i.kind === "text-edit",
  );
  const coverIds =
    textEdits.length > 0
      ? await removeEditedText(doc, pages, textEdits)
      : new Set<string>();
  const editFonts =
    textEdits.length > 0
      ? await embedEditFonts(doc, textEdits, font)
      : new Map<string, PDFFont>();

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
      case "line": {
        const { r, g, b } = hexToRgb(item.color);
        const color = rgb(r, g, b);
        const start = { x: item.x, y: pageH - item.y };
        const end = { x: item.x2, y: pageH - item.y2 };
        page.drawLine({ start, end, thickness: item.strokeWidth, color });
        if (item.arrow) {
          // Two short strokes at ±150° from the line direction.
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const len = Math.max(6, item.strokeWidth * 4);
          for (const off of [Math.PI - 0.5, -(Math.PI - 0.5)]) {
            page.drawLine({
              start: end,
              end: {
                x: end.x + len * Math.cos(angle + off),
                y: end.y + len * Math.sin(angle + off),
              },
              thickness: item.strokeWidth,
              color,
            });
          }
        }
        break;
      }
      case "ellipse": {
        const { r, g, b } = hexToRgb(item.color);
        page.drawEllipse({
          x: item.x + item.w / 2,
          y: pageH - item.y - item.h / 2,
          xScale: item.w / 2,
          yScale: item.h / 2,
          ...(item.fill
            ? { color: rgb(r, g, b), opacity: item.opacity }
            : {
                borderColor: rgb(r, g, b),
                borderWidth: 2,
                borderOpacity: item.opacity,
              }),
        });
        break;
      }
      case "path": {
        if (item.points.length < 2) break;
        const { r, g, b } = hexToRgb(item.color);
        // SVG path coordinates run y-down from the given origin — matching
        // our top-left-origin points directly.
        const d =
          `M ${item.points[0].x} ${item.points[0].y} ` +
          item.points
            .slice(1)
            .map((p) => `L ${p.x} ${p.y}`)
            .join(" ");
        page.drawSvgPath(d, {
          x: item.x,
          y: pageH - item.y,
          borderColor: rgb(r, g, b),
          borderWidth: item.strokeWidth,
        });
        break;
      }
      case "text-edit": {
        // Cover fallback only when the original couldn't be removed from the
        // content stream (XObject text, malformed stream, forceCover flag).
        if (coverIds.has(item.id)) {
          const bg = hexToRgb(item.bgColor);
          page.drawRectangle({
            x: item.x - 1,
            y: pageH - item.y - item.h - 1,
            width: item.w + 2,
            height: item.h + 2,
            color: rgb(bg.r, bg.g, bg.b),
          });
        }
        const tc = hexToRgb(item.color);
        page.drawText(item.newText, {
          x: item.x,
          y: pageH - item.baseline,
          size: item.fontSize,
          font: editFonts.get(item.id) ?? font,
          color: rgb(tc.r, tc.g, tc.b),
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
