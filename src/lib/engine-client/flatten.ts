import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  hexToRgb,
  type FormFieldItem,
  type OverlayItem,
  type TextEditItem,
} from "@/lib/editor/types";
import { baseName } from "./pages";
import { drawAngle, pageRotation, toPdfPoint, toPdfRect } from "./page-rotate";
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
  const rotate = drawAngle(page);
  const lineHeight = item.fontSize * 1.25;
  const lines = item.text.split("\n");
  lines.forEach((line, i) => {
    if (!line) return;
    // item.y is the top of the text block; drawText wants the baseline.
    const baselineFromTop = item.y + i * lineHeight + item.fontSize * 0.85;
    const at = toPdfPoint(page, item.x, baselineFromTop);
    page.drawText(line, {
      x: at.x,
      y: at.y,
      size: item.fontSize,
      font,
      color: rgb(r, g, b),
      rotate,
    });
  });
}

/**
 * Remove the original text of every text-edit item from its page's content
 * stream. Items whose text can't be located (e.g. inside a Form XObject) or
 * that are flagged forceCover are returned for the cover fallback. Also
 * reports which document font drew each edited line, so replacements can be
 * set in the document's own typeface.
 */
async function removeEditedText(
  doc: PDFDocument,
  pages: PDFPage[],
  textEdits: TextEditItem[],
): Promise<{
  coverIds: Set<string>;
  nativeFonts: Map<string, { resName: string; size: number }>;
}> {
  const coverIds = new Set<string>();
  const nativeFonts = new Map<string, { resName: string; size: number }>();
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
      const { removed, invisible, regionFonts } = removeTextInRegions(
        doc,
        page,
        removable.map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h, baseline: i.baseline })),
      );
      removable.forEach((item, i) => {
        if (removed[i] === 0 && invisible[i] === 0) coverIds.add(item.id);
        if (regionFonts[i]) nativeFonts.set(item.id, regionFonts[i]!);
      });
    } catch (err) {
      // Malformed stream — never fail the export; cover every line instead.
      console.error(`text removal failed on page ${pageIdx + 1}:`, err);
      for (const item of removable) coverIds.add(item.id);
    }
  }
  return { coverIds, nativeFonts };
}

/** Embed the Liberation variant each text edit needs (once per variant). */
async function embedEditFonts(
  doc: PDFDocument,
  textEdits: TextEditItem[],
  fallback: () => Promise<PDFFont>,
): Promise<Map<string, PDFFont>> {
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
        byVariant.set(key, await fallback());
      }
    }
    byItem.set(item.id, byVariant.get(key)!);
  }
  return byItem;
}

/**
 * Fill interactive AcroForm fields via pdf-lib's form API, then optionally
 * flatten the form (bake values into page content, dropping interactivity).
 * A field that can't be resolved never fails the export — it's just skipped.
 */
function applyFormFields(
  doc: PDFDocument,
  formFields: FormFieldItem[],
  flattenForms: boolean,
) {
  const form = doc.getForm();
  for (const item of formFields) {
    try {
      switch (item.fieldType) {
        case "text":
          form.getTextField(item.fieldName).setText(String(item.value ?? ""));
          break;
        case "checkbox": {
          const cb = form.getCheckBox(item.fieldName);
          if (item.value) cb.check();
          else cb.uncheck();
          break;
        }
        case "dropdown":
          if (item.value) form.getDropdown(item.fieldName).select(String(item.value));
          break;
        case "radio":
          if (item.value) form.getRadioGroup(item.fieldName).select(String(item.value));
          break;
      }
    } catch (err) {
      console.error(`form field ${item.fieldName} could not be filled:`, err);
    }
  }
  if (flattenForms) {
    try {
      form.flatten();
    } catch (err) {
      console.error("form flatten failed:", err);
    }
  }
}

/**
 * Stamp overlay items onto the PDF. options.items is an OverlayItem[] — this
 * runs inside the worker, so everything is plain serializable data.
 */
export const flatten: EngineOp = async ([file], options) => {
  const items = (options.items ?? []) as OverlayItem[];
  const doc = await PDFDocument.load(file.data);
  const pages = doc.getPages();

  // Interactive form fields: fill (and optionally flatten) via the form API.
  const formFields = items.filter(
    (i): i is FormFieldItem => i.kind === "form-field",
  );
  if (formFields.length > 0) {
    applyFormFields(doc, formFields, options.flattenForms === true);
  }

  // Helvetica is embedded lazily — an export whose edits all reuse document
  // fonts shouldn't carry an unused font dict.
  let helvetica: PDFFont | null = null;
  const getHelvetica = async (): Promise<PDFFont> =>
    (helvetica ??= await doc.embedFont(StandardFonts.Helvetica));

  // Inline text edits: remove originals first (before any drawing appends
  // content), then draw replacements in the loop below — preferring the
  // document's own font, with Liberation only for text it can't encode.
  const textEdits = items.filter(
    (i): i is TextEditItem => i.kind === "text-edit",
  );
  let coverIds = new Set<string>();
  const nativeTexts = new Map<
    string,
    import("./native-text").PreparedNativeText
  >();
  let editFonts = new Map<string, PDFFont>();
  if (textEdits.length > 0) {
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    doc.registerFontkit(fontkit);
    const removal = await removeEditedText(doc, pages, textEdits);
    coverIds = removal.coverIds;

    const { prepareNativeText } = await import("./native-text");
    for (const item of textEdits) {
      const native = removal.nativeFonts.get(item.id);
      const page = pages[item.page];
      if (!native || !page) continue;
      const prepared = prepareNativeText(page, native.resName, item.newText, fontkit);
      if (prepared) nativeTexts.set(item.id, prepared);
    }

    const needLiberation = textEdits.filter((i) => !nativeTexts.has(i.id));
    if (needLiberation.length > 0) {
      editFonts = await embedEditFonts(doc, needLiberation, getHelvetica);
    }
  }

  for (const item of items) {
    const page = pages[item.page];
    if (!page) continue;
    // Overlay coords are in DISPLAYED (top-left, rotation-aware) space; map to
    // pdf-lib's unrotated space and rotate drawn content so it reads upright.
    const rotate = drawAngle(page);
    const rot = pageRotation(page);
    switch (item.kind) {
      case "text":
        drawText(page, await getHelvetica(), item);
        break;
      case "rect": {
        const { r, g, b } = hexToRgb(item.color);
        page.drawRectangle({
          ...toPdfRect(page, item.x, item.y, item.w, item.h),
          ...(item.fill
            ? { color: rgb(r, g, b), opacity: item.opacity }
            : { borderColor: rgb(r, g, b), borderWidth: 2, borderOpacity: item.opacity }),
        });
        break;
      }
      case "highlight":
        page.drawRectangle({
          ...toPdfRect(page, item.x, item.y, item.w, item.h),
          color: HIGHLIGHT.color,
          opacity: HIGHLIGHT.opacity,
        });
        break;
      case "image": {
        const { bytes, isPng } = dataUrlToBytes(item.dataUrl);
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        // Anchor at the box's displayed bottom-left corner; rotate to match.
        const at = toPdfPoint(page, item.x, item.y + item.h);
        page.drawImage(image, {
          x: at.x,
          y: at.y,
          width: item.w,
          height: item.h,
          rotate,
        });
        break;
      }
      case "line": {
        const { r, g, b } = hexToRgb(item.color);
        const color = rgb(r, g, b);
        const start = toPdfPoint(page, item.x, item.y);
        const end = toPdfPoint(page, item.x2, item.y2);
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
        const box = toPdfRect(page, item.x, item.y, item.w, item.h);
        page.drawEllipse({
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          xScale: box.width / 2,
          yScale: box.height / 2,
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
        const color = rgb(r, g, b);
        if (rot === 0) {
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
            y: page.getHeight() - item.y,
            borderColor: color,
            borderWidth: item.strokeWidth,
          });
        } else {
          // Rotated page: map each absolute point and stroke as segments.
          const pts = item.points.map((p) =>
            toPdfPoint(page, item.x + p.x, item.y + p.y),
          );
          for (let i = 1; i < pts.length; i++) {
            page.drawLine({
              start: pts[i - 1],
              end: pts[i],
              thickness: item.strokeWidth,
              color,
            });
          }
        }
        break;
      }
      case "text-edit": {
        // Cover fallback only when the original couldn't be removed from the
        // content stream (XObject text, malformed stream, forceCover flag).
        if (coverIds.has(item.id)) {
          const bg = hexToRgb(item.bgColor);
          page.drawRectangle({
            ...toPdfRect(page, item.x - 1, item.y - 1, item.w + 2, item.h + 2),
            color: rgb(bg.r, bg.g, bg.b),
          });
        }
        const at = toPdfPoint(page, item.x, item.baseline);
        const native = nativeTexts.get(item.id);
        if (native) {
          const { drawNativeText } = await import("./native-text");
          drawNativeText(page, native, {
            x: at.x,
            baselineY: at.y,
            size: item.fontSize,
            colorHex: item.color,
            rotate: rot,
          });
          break;
        }
        const tc = hexToRgb(item.color);
        page.drawText(item.newText, {
          x: at.x,
          y: at.y,
          size: item.fontSize,
          font: editFonts.get(item.id) ?? (await getHelvetica()),
          color: rgb(tc.r, tc.g, tc.b),
          rotate,
        });
        break;
      }
      case "form-field":
        // Filled above via the form API — nothing to draw on the page.
        break;
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
