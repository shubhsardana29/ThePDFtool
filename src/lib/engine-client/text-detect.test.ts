import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { detectTextLines, sampleLineColors } from "./text-detect";
import type { PdfjsDocument } from "./render";

async function loadWithPdfjs(data: Uint8Array): Promise<PdfjsDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    standardFontDataUrl: new URL(
      "pdfjs-dist/standard_fonts/",
      import.meta.url,
    ).href.replace("/src/lib/engine-client/", "/node_modules/"),
  }).promise;
  return doc as unknown as PdfjsDocument;
}

async function makeDoc(
  draw: (page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont) => void,
  rotate = 0,
): Promise<PdfjsDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, 800]);
  if (rotate) page.setRotation(degrees(rotate));
  draw(page, font);
  return loadWithPdfjs(await doc.save());
}

describe("detectTextLines", () => {
  it("detects a line with correct geometry", async () => {
    const doc = await makeDoc((page, font) => {
      page.drawText("Hello inline editing", { x: 72, y: 700, size: 24, font });
    });
    const lines = await detectTextLines(doc, 0);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.text).toBe("Hello inline editing");
    expect(line.fontSize).toBeCloseTo(24, 5);
    expect(line.baseline).toBeCloseTo(100, 1); // 800 - 700
    expect(line.x).toBeCloseTo(72, 1);
    expect(line.w).toBeGreaterThan(150);
    // y = baseline - ascent*size; h spans ascent+|descent|
    expect(line.y).toBeLessThan(line.baseline);
    expect(line.y + line.h).toBeGreaterThan(line.baseline);
  });

  it("merges adjacent runs on one baseline into one line", async () => {
    const doc = await makeDoc((page, font) => {
      page.drawText("Left part", { x: 72, y: 700, size: 12, font });
      page.drawText("right part", { x: 130, y: 700, size: 12, font });
    });
    const lines = await detectTextLines(doc, 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain("Left part");
    expect(lines[0].text).toContain("right part");
  });

  it("splits same-baseline columns separated by a wide gap", async () => {
    const doc = await makeDoc((page, font) => {
      page.drawText("Column A", { x: 72, y: 700, size: 12, font });
      page.drawText("Column B", { x: 400, y: 700, size: 12, font });
    });
    const lines = await detectTextLines(doc, 0);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.text)).toEqual(["Column A", "Column B"]);
  });

  it("orders lines top of page first", async () => {
    const doc = await makeDoc((page, font) => {
      page.drawText("bottom", { x: 72, y: 100, size: 12, font });
      page.drawText("top", { x: 72, y: 700, size: 12, font });
    });
    const lines = await detectTextLines(doc, 0);
    expect(lines.map((l) => l.text)).toEqual(["top", "bottom"]);
  });

  it("returns no targets on rotated pages", async () => {
    const doc = await makeDoc((page, font) => {
      page.drawText("rotated", { x: 72, y: 700, size: 12, font });
    }, 90);
    expect(await detectTextLines(doc, 0)).toEqual([]);
  });
});

function imageData(
  width: number,
  height: number,
  fill: [number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}

function setPx(img: ImageData, x: number, y: number, c: [number, number, number]) {
  const i = (y * img.width + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
}

describe("sampleLineColors", () => {
  const bbox = { x: 0, y: 0, w: 19, h: 9 };

  it("finds dark text on a light background", () => {
    const img = imageData(20, 10, [255, 255, 255]);
    for (let x = 5; x < 15; x++) setPx(img, x, 5, [20, 20, 120]);
    const { textColor, bgColor } = sampleLineColors(img, bbox);
    expect(bgColor).toBe("#ffffff");
    expect(textColor).toBe("#141478");
  });

  it("detects a non-white background from the border ring", () => {
    const img = imageData(20, 10, [240, 220, 200]);
    for (let x = 5; x < 15; x++) setPx(img, x, 5, [0, 0, 0]);
    const { bgColor } = sampleLineColors(img, bbox);
    expect(bgColor).toBe("#f0dcc8");
  });

  it("defaults to black text when nothing contrasts", () => {
    const img = imageData(20, 10, [250, 250, 250]);
    const { textColor } = sampleLineColors(img, bbox);
    expect(textColor).toBe("#000000");
  });
});
