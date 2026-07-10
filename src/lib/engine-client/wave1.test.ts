import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { flattenPdf, headerFooter, resize, sanitize } from "./pdflib-ops";
import type { EngineFile } from "./types";

async function doc(pages: [number, number][], meta = false): Promise<EngineFile> {
  const d = await PDFDocument.create();
  if (meta) {
    d.setTitle("Secret Title");
    d.setAuthor("Jane Secret");
  }
  const font = await d.embedFont(StandardFonts.Helvetica);
  pages.forEach(([w, h], i) => d.addPage([w, h]).drawText(`P${i}`, { x: 10, y: 10, size: 8, font }));
  return { name: "d.pdf", data: await d.save(), mime: "application/pdf" };
}

describe("sanitize op", () => {
  it("clears document info metadata", async () => {
    const [out] = await sanitize([await doc([[400, 600]], true)], {});
    const d = await PDFDocument.load(out.data);
    expect(d.getTitle() ?? "").toBe("");
    expect(d.getAuthor() ?? "").toBe("");
  });
});

describe("flatten-pdf op", () => {
  it("removes interactive form fields", async () => {
    const d = await PDFDocument.create();
    const page = d.addPage([400, 600]);
    d.getForm().createTextField("name").addToPage(page, { x: 50, y: 500, width: 200, height: 20 });
    const src: EngineFile = { name: "f.pdf", data: await d.save(), mime: "application/pdf" };
    const [out] = await flattenPdf([src], {});
    const after = await PDFDocument.load(out.data);
    expect(after.getForm().getFields()).toHaveLength(0);
  });
});

describe("header-footer op", () => {
  it("stamps header/footer with placeholders substituted", async () => {
    const [out] = await headerFooter([await doc([[400, 600], [400, 600]])], {
      header: "Confidential",
      footer: "Page {page} of {pages}",
      align: "center",
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const d = await pdfjs.getDocument({ data: out.data.slice() }).promise;
    const text = async (p: number) =>
      (await (await d.getPage(p)).getTextContent()).items.map((i) => ("str" in i ? i.str : "")).join(" ");
    const p1 = await text(1);
    await d.loadingTask.destroy();
    expect(p1).toContain("Confidential");
    expect(p1).toContain("Page 1 of 2");
  });
});

describe("resize op", () => {
  it("scales pages to A4 preserving orientation", async () => {
    const [out] = await resize([await doc([[300, 300], [800, 400]])], { size: "a4" });
    const d = await PDFDocument.load(out.data);
    const p0 = d.getPage(0).getSize();
    const p1 = d.getPage(1).getSize();
    // Portrait source → A4 portrait; landscape source → A4 landscape.
    expect(p0.height).toBeGreaterThan(p0.width);
    expect(p1.width).toBeGreaterThan(p1.height);
    expect(Math.round(p0.height)).toBe(842);
  });
});
