import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { bates, deletePages, nUp } from "./pdflib-ops";
import type { EngineFile } from "./types";

async function multiPage(n: number, w = 400, h = 600): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) {
    doc.addPage([w, h]).drawText(`Page ${i + 1}`, { x: 50, y: 550, size: 20, font });
  }
  return { name: "doc.pdf", data: await doc.save(), mime: "application/pdf" };
}

async function pageCount(data: Uint8Array): Promise<number> {
  return (await PDFDocument.load(data)).getPageCount();
}

describe("delete-pages op", () => {
  it("removes the selected pages and keeps the rest", async () => {
    const [out] = await deletePages([await multiPage(5)], { pages: "2, 4" });
    expect(await pageCount(out.data)).toBe(3);
  });
  it("rejects deleting every page", async () => {
    await expect(deletePages([await multiPage(3)], { pages: "1-3" })).rejects.toThrow(/every page/);
  });
  it("rejects an empty selection", async () => {
    await expect(deletePages([await multiPage(3)], { pages: "" })).rejects.toThrow();
  });
});

describe("n-up op", () => {
  it("packs 4 pages onto 2 landscape sheets at 2-up", async () => {
    const [out] = await nUp([await multiPage(4)], { perSheet: "2" });
    const doc = await PDFDocument.load(out.data);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height); // landscape
  });
  it("packs 4 pages onto 1 sheet at 4-up", async () => {
    const [out] = await nUp([await multiPage(4)], { perSheet: "4" });
    expect(await pageCount(out.data)).toBe(1);
  });
});

describe("bates op", () => {
  it("stamps sequential zero-padded numbers with a prefix", async () => {
    const [out] = await bates([await multiPage(2)], {
      prefix: "ABC-",
      start: 1,
      digits: 6,
      position: "bottom-right",
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: out.data.slice() }).promise;
    const text = async (p: number) =>
      (await (await doc.getPage(p)).getTextContent()).items
        .map((i) => ("str" in i ? i.str : ""))
        .join(" ");
    const p1 = await text(1);
    const p2 = await text(2);
    await doc.loadingTask.destroy();
    expect(p1).toContain("ABC-000001");
    expect(p2).toContain("ABC-000002");
  });
});
