import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { annotate } from "./pdflib-ops";
import type { EngineFile } from "./types";

async function blank(): Promise<EngineFile> {
  const d = await PDFDocument.create();
  d.addPage([400, 600]);
  return { name: "d.pdf", data: await d.save(), mime: "application/pdf" };
}

describe("annotate op", () => {
  it("writes real Text (note) and Highlight annotations", async () => {
    const [out] = await annotate([await blank()], {
      items: [
        { kind: "note", page: 0, x: 100, y: 100, text: "Please review this" },
        { kind: "highlight", page: 0, x: 60, y: 200, w: 180, h: 16 },
      ],
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: out.data.slice() }).promise;
    const annots = await (await doc.getPage(1)).getAnnotations();
    const subtypes = annots.map((a) => a.subtype).sort();
    const note = annots.find((a) => a.subtype === "Text");
    await doc.loadingTask.destroy();

    expect(subtypes).toEqual(["Highlight", "Text"]);
    expect(note?.contentsObj?.str ?? note?.contents).toBe("Please review this");
  });

  it("appends to a page's existing annotations without dropping them", async () => {
    const [first] = await annotate([await blank()], {
      items: [{ kind: "note", page: 0, x: 50, y: 50, text: "one" }],
    });
    const [second] = await annotate(
      [{ name: "d.pdf", data: first.data, mime: "application/pdf" }],
      { items: [{ kind: "note", page: 0, x: 80, y: 80, text: "two" }] },
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: second.data.slice() }).promise;
    const annots = await (await doc.getPage(1)).getAnnotations();
    await doc.loadingTask.destroy();
    expect(annots.filter((a) => a.subtype === "Text")).toHaveLength(2);
  });
});
