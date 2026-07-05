import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { baseName, parsePageRanges, parseRangeGroups } from "./pages";
import {
  extract,
  imagesToPdf,
  merge,
  organize,
  pageNumbers,
  rotate,
  split,
  watermark,
} from "./pdflib-ops";
import type { EngineFile } from "./types";

/** Build a PDF whose page N (1-based) is N*100 points wide, so tests can
 *  identify which original page ended up where. */
async function makePdf(name: string, pages: number): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pages; i++) doc.addPage([i * 100, 400]);
  return { name, data: await doc.save(), mime: "application/pdf" };
}

async function load(file: EngineFile) {
  return PDFDocument.load(file.data);
}

// 1×1 red pixel PNG
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

describe("parsePageRanges", () => {
  it("parses single pages and ranges to zero-based indices", () => {
    expect(parsePageRanges("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
  });
  it("rejects out-of-bounds pages", () => {
    expect(() => parsePageRanges("9-11", 10)).toThrow(/out of bounds/);
    expect(() => parsePageRanges("0", 10)).toThrow(/out of bounds/);
  });
  it("rejects malformed input", () => {
    expect(() => parsePageRanges("abc", 10)).toThrow(/Invalid/);
  });
});

describe("parseRangeGroups", () => {
  it("returns one group per comma-separated part", () => {
    expect(parseRangeGroups("1-2, 4", 5)).toEqual([[0, 1], [3]]);
  });
  it("defaults to one group per page when empty", () => {
    expect(parseRangeGroups("", 3)).toEqual([[0], [1], [2]]);
  });
});

describe("baseName", () => {
  it("strips extension and directories", () => {
    expect(baseName("report.pdf")).toBe("report");
    expect(baseName("C:\\docs\\report.v2.pdf")).toBe("report.v2");
  });
});

describe("merge", () => {
  it("concatenates pages in file order", async () => {
    const [a, b] = await Promise.all([makePdf("a.pdf", 2), makePdf("b.pdf", 3)]);
    const [out] = await merge([a, b], {});
    const doc = await load(out);
    expect(doc.getPageCount()).toBe(5);
    // page 3 of the merged doc is page 1 of b.pdf (width 100)
    expect(doc.getPage(2).getWidth()).toBe(100);
  });
});

describe("split", () => {
  it("produces one file per range", async () => {
    const src = await makePdf("doc.pdf", 4);
    const outs = await split([src], { ranges: "1-3, 4" });
    expect(outs.map((o) => o.name)).toEqual(["doc-part1.pdf", "doc-part2.pdf"]);
    expect((await load(outs[0])).getPageCount()).toBe(3);
    expect((await load(outs[1])).getPageCount()).toBe(1);
  });
  it("splits into single pages when no ranges given", async () => {
    const src = await makePdf("doc.pdf", 3);
    const outs = await split([src], { ranges: "" });
    expect(outs).toHaveLength(3);
  });
});

describe("extract", () => {
  it("extracts only the selected pages", async () => {
    const src = await makePdf("doc.pdf", 5);
    const [out] = await extract([src], { pages: "2, 4" });
    const doc = await load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(200);
    expect(doc.getPage(1).getWidth()).toBe(400);
  });
  it("throws when no pages are selected", async () => {
    const src = await makePdf("doc.pdf", 2);
    await expect(extract([src], { pages: "" })).rejects.toThrow(/No pages/);
  });
});

describe("rotate", () => {
  it("rotates all pages by the given angle", async () => {
    const src = await makePdf("doc.pdf", 2);
    const [out] = await rotate([src], { angle: "90", pages: "" });
    const doc = await load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90]);
  });
  it("rotates only targeted pages", async () => {
    const src = await makePdf("doc.pdf", 3);
    const [out] = await rotate([src], { angle: "180", pages: "2" });
    const doc = await load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([
      0, 180, 0,
    ]);
  });
});

describe("organize", () => {
  it("reorders and drops pages per the order array", async () => {
    const src = await makePdf("doc.pdf", 3);
    const [out] = await organize([src], { order: [2, 0] });
    const doc = await load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(300);
    expect(doc.getPage(1).getWidth()).toBe(100);
  });
  it("rejects an empty order", async () => {
    const src = await makePdf("doc.pdf", 2);
    await expect(organize([src], { order: [] })).rejects.toThrow(/No pages/);
  });
});

describe("watermark", () => {
  it("keeps page count and produces a larger document", async () => {
    const src = await makePdf("doc.pdf", 2);
    const originalSize = src.data.length;
    const [out] = await watermark([src], {
      text: "DRAFT",
      fontSize: 48,
      opacity: 0.3,
      diagonal: true,
    });
    const doc = await load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(out.data.length).toBeGreaterThan(originalSize);
  });
});

describe("pageNumbers", () => {
  it("keeps page count and adds content", async () => {
    const src = await makePdf("doc.pdf", 3);
    const originalSize = src.data.length;
    const [out] = await pageNumbers([src], {
      position: "bottom-center",
      format: "n-of-total",
      start: 1,
    });
    expect((await load(out)).getPageCount()).toBe(3);
    expect(out.data.length).toBeGreaterThan(originalSize);
  });
});

describe("imagesToPdf", () => {
  it("creates one page per image sized to fit", async () => {
    const img: EngineFile = { name: "px.png", data: TINY_PNG, mime: "image/png" };
    const [out] = await imagesToPdf([img], { pageSize: "fit", margin: 10 });
    const doc = await load(out);
    expect(doc.getPageCount()).toBe(1);
    // 1×1 image + 10pt margin on each side
    expect(doc.getPage(0).getWidth()).toBe(21);
  });
  it("uses fixed page sizes when requested", async () => {
    const img: EngineFile = { name: "px.png", data: TINY_PNG, mime: "image/png" };
    const [out] = await imagesToPdf([img], { pageSize: "a4", margin: 0 });
    const doc = await load(out);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  });
});
