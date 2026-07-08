import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { OverlayItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import type { EngineFile } from "./types";

async function makePdf(pages: number): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([600, 800]);
  return { name: "doc.pdf", data: await doc.save(), mime: "application/pdf" };
}

// 1×1 red pixel PNG
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("flatten", () => {
  it("stamps text, shapes, and images without changing page count", async () => {
    const src = await makePdf(2);
    const originalSize = src.data.length;
    const items: OverlayItem[] = [
      { id: "1", kind: "text", page: 0, x: 50, y: 50, text: "Hello\nWorld", fontSize: 18, color: "#d92626" },
      { id: "2", kind: "rect", page: 0, x: 100, y: 200, w: 120, h: 60, color: "#2266dd", fill: false, opacity: 1 },
      { id: "3", kind: "highlight", page: 1, x: 40, y: 40, w: 200, h: 20 },
      { id: "4", kind: "image", page: 1, x: 300, y: 300, w: 80, h: 80, dataUrl: PNG_DATA_URL },
    ];
    const [out] = await flatten([src], { items });
    expect(out.name).toBe("doc-edited.pdf");
    const doc = await PDFDocument.load(out.data);
    expect(doc.getPageCount()).toBe(2);
    expect(out.data.length).toBeGreaterThan(originalSize);
  });

  it("stamps lines, arrows, ellipses, and pen paths", async () => {
    const src = await makePdf(1);
    const items: OverlayItem[] = [
      { id: "l1", kind: "line", page: 0, x: 50, y: 50, x2: 200, y2: 80, color: "#d92626", strokeWidth: 2, arrow: false },
      { id: "a1", kind: "line", page: 0, x: 50, y: 120, x2: 200, y2: 120, color: "#2266dd", strokeWidth: 3, arrow: true },
      { id: "e1", kind: "ellipse", page: 0, x: 250, y: 50, w: 120, h: 70, color: "#16a34a", fill: false, opacity: 1 },
      {
        id: "p1",
        kind: "path",
        page: 0,
        x: 60,
        y: 200,
        w: 100,
        h: 40,
        points: [
          { x: 0, y: 20 },
          { x: 30, y: 0 },
          { x: 60, y: 40 },
          { x: 100, y: 10 },
        ],
        color: "#d92626",
        strokeWidth: 2,
      },
    ];
    const [out] = await flatten([src], { items });
    const doc = await PDFDocument.load(out.data);
    expect(doc.getPageCount()).toBe(1);
    expect(out.data.length).toBeGreaterThan(src.data.length);
  });

  it("ignores items pointing at nonexistent pages", async () => {
    const src = await makePdf(1);
    const items: OverlayItem[] = [
      { id: "1", kind: "text", page: 9, x: 0, y: 0, text: "ghost", fontSize: 12, color: "#000000" },
    ];
    const [out] = await flatten([src], { items });
    expect((await PDFDocument.load(out.data)).getPageCount()).toBe(1);
  });

  it("rejects malformed image data", async () => {
    const src = await makePdf(1);
    const items: OverlayItem[] = [
      { id: "1", kind: "image", page: 0, x: 0, y: 0, w: 10, h: 10, dataUrl: "not-a-data-url" },
    ];
    await expect(flatten([src], { items })).rejects.toThrow();
  });
});

describe("diffLines", async () => {
  const { diffLines } = await import("@/lib/editor/diff");
  it("marks added and removed lines", () => {
    const d = diffLines(["a", "b", "c"], ["a", "x", "c"]);
    expect(d).toEqual([
      { type: "same", text: "a" },
      { type: "removed", text: "b" },
      { type: "added", text: "x" },
      { type: "same", text: "c" },
    ]);
  });
  it("handles empty inputs", () => {
    expect(diffLines([], ["a"])).toEqual([{ type: "added", text: "a" }]);
    expect(diffLines(["a"], [])).toEqual([{ type: "removed", text: "a" }]);
  });
});
