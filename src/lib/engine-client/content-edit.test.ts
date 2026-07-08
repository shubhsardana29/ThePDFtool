import {
  PDFDocument,
  PDFName,
  StandardFonts,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { removeTextInRegions, type EditRegion } from "./content-edit";

// ——— helpers ———

interface Extracted {
  str: string;
  x: number;
  y: number;
}

async function extract(data: Uint8Array): Promise<Extracted[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const items: Extracted[] = [];
  for (const item of tc.items) {
    if ("str" in item && item.str.trim()) {
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
    }
  }
  await doc.loadingTask.destroy();
  return items;
}

/** Build a single-page doc with a hand-written content stream + Type1 font. */
async function manualDoc(
  content: string,
  opts: { widths?: boolean } = {},
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const ctx = doc.context;
  const widthEntries =
    opts.widths !== false
      ? { FirstChar: 32, LastChar: 126, Widths: new Array<number>(95).fill(500) }
      : {};
  const fontRef = ctx.register(
    ctx.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
      Encoding: "WinAnsiEncoding",
      ...widthEntries,
    }),
  );
  page.node.set(PDFName.of("Resources"), ctx.obj({ Font: { F1: fontRef } }));
  page.node.set(PDFName.of("Contents"), ctx.register(ctx.stream(content)));
  // Round-trip through save/load so streams arrive the way real files do.
  return PDFDocument.load(await doc.save());
}

function region(
  x: number,
  w: number,
  baselineFromBottom: number,
  pageH = 800,
): EditRegion {
  return {
    x,
    w,
    y: pageH - baselineFromBottom - 10,
    h: 13,
    baseline: pageH - baselineFromBottom,
  };
}

// ——— tests ———

describe("removeTextInRegions", () => {
  it("removes one line from a pdf-lib document, leaving siblings untouched", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    const page = src.addPage([600, 800]);
    page.drawText("keep top", { x: 72, y: 720, size: 14, font });
    page.drawText("remove me", { x: 72, y: 690, size: 14, font });
    page.drawText("keep bottom", { x: 72, y: 660, size: 14, font });
    const doc = await PDFDocument.load(await src.save());

    const before = await extract(await doc.save());
    const keepTop = before.find((i) => i.str === "keep top")!;

    const result = removeTextInRegions(doc, doc.getPage(0), [region(72, 100, 690)]);
    expect(result.removed).toEqual([1]);
    expect(result.invisible).toEqual([0]);

    const after = await extract(await doc.save());
    expect(after.map((i) => i.str)).toEqual(["keep top", "keep bottom"]);
    const keepTopAfter = after.find((i) => i.str === "keep top")!;
    expect(keepTopAfter.x).toBeCloseTo(keepTop.x, 3);
    expect(keepTopAfter.y).toBeCloseTo(keepTop.y, 3);
  });

  it("removes all runs of a multi-run line covered by one region", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    const page = src.addPage([600, 800]);
    page.drawText("left", { x: 72, y: 700, size: 12, font });
    page.drawText("right", { x: 110, y: 700, size: 12, font });
    const doc = await PDFDocument.load(await src.save());

    const result = removeTextInRegions(doc, doc.getPage(0), [region(72, 80, 700)]);
    expect(result.removed).toEqual([2]);
    expect(await extract(await doc.save())).toEqual([]);
  });

  it("reports zero matches when the region hits nothing (fallback signal)", async () => {
    const src = await PDFDocument.create();
    const font = await src.embedFont(StandardFonts.Helvetica);
    src.addPage([600, 800]).drawText("elsewhere", { x: 72, y: 200, size: 12, font });
    const doc = await PDFDocument.load(await src.save());

    const result = removeTextInRegions(doc, doc.getPage(0), [region(72, 100, 700)]);
    expect(result.removed).toEqual([0]);
    expect((await extract(await doc.save())).map((i) => i.str)).toEqual(["elsewhere"]);
  });

  it("compensates the advance when a dependent show op follows (widths known)", async () => {
    // (AAAA) advances 4 × 0.5 × 12 = 24pt; (BBBB) starts at 100+24=124 and
    // must stay there after (AAAA) is deleted.
    const doc = await manualDoc(
      "BT /F1 12 Tf 100 700 Td (AAAA) Tj (BBBB) Tj ET",
    );
    // pdfjs merges the two contiguous runs into a single item at x=100.
    const before = await extract(await doc.save());
    expect(before.map((i) => i.str)).toEqual(["AAAABBBB"]);
    expect(before[0].x).toBeCloseTo(100, 2);

    const result = removeTextInRegions(doc, doc.getPage(0), [region(99, 20, 700)]);
    expect(result.removed).toEqual([1]);

    const after = await extract(await doc.save());
    expect(after.map((i) => i.str)).toEqual(["BBBB"]);
    // The TJ compensator keeps BBBB where the deleted AAAA's advance put it.
    expect(after[0].x).toBeCloseTo(124, 2);
    expect(after[0].y).toBeCloseTo(700, 2);
  });

  it("preserves the line advance when removing a ' (quote) show op", async () => {
    const doc = await manualDoc(
      "BT /F1 12 Tf 14 TL 100 700 Td (line one) Tj (line two) ' (line three) ' ET",
    );
    const before = await extract(await doc.save());
    expect(before.find((i) => i.str === "line three")!.y).toBeCloseTo(672, 2);

    // line two sits at baseline 686 (700 - TL 14)
    const result = removeTextInRegions(doc, doc.getPage(0), [region(99, 60, 686)]);
    expect(result.removed).toEqual([1]);

    const after = await extract(await doc.save());
    expect(after.map((i) => i.str)).toEqual(["line one", "line three"]);
    expect(after.find((i) => i.str === "line three")!.y).toBeCloseTo(672, 2);
  });

  it("tracks q/Q + cm transforms when matching", async () => {
    const doc = await manualDoc(
      "q 1 0 0 1 50 50 cm BT /F1 12 Tf 100 700 Td (shifted) Tj ET Q " +
        "BT /F1 12 Tf 100 700 Td (unshifted) Tj ET",
    );
    // device baseline of "shifted" = 750; of "unshifted" = 700
    const result = removeTextInRegions(doc, doc.getPage(0), [region(149, 60, 750)]);
    expect(result.removed).toEqual([1]);
    const after = await extract(await doc.save());
    expect(after.map((i) => i.str)).toEqual(["unshifted"]);
  });

  it("neutralizes invisibly when widths are unavailable and a dependent follows", async () => {
    const doc = await manualDoc(
      "BT /F1 12 Tf 100 700 Td (AAAA) Tj (BBBB) Tj ET",
      { widths: false },
    );
    const result = removeTextInRegions(doc, doc.getPage(0), [region(99, 20, 700)]);
    expect(result.removed).toEqual([0]);
    expect(result.invisible).toEqual([1]);
    // The op is retained (still extractable) but renders in mode 3 (invisible),
    // and BBBB's position is untouched because the original advance survives.
    const after = await extract(await doc.save());
    expect(after.map((i) => i.str).join("")).toBe("AAAABBBB");
  });

  it("does not touch text inside Form XObjects (fallback signal)", async () => {
    const inner = await PDFDocument.create();
    const innerFont = await inner.embedFont(StandardFonts.Helvetica);
    inner.addPage([600, 800]).drawText("in xobject", { x: 100, y: 700, size: 12, font: innerFont });

    const outer = await PDFDocument.create();
    const [embedded] = await outer.embedPdf(await inner.save());
    outer.addPage([600, 800]).drawPage(embedded);
    const doc = await PDFDocument.load(await outer.save());

    const result = removeTextInRegions(doc, doc.getPage(0), [region(99, 80, 700)]);
    expect(result.removed).toEqual([0]);
    expect(result.invisible).toEqual([0]);
    const after = await extract(await doc.save());
    expect(after.map((i) => i.str)).toEqual(["in xobject"]);
  });
});
