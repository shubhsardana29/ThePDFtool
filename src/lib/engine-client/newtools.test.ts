import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { crop, editMetadata } from "./pdflib-ops";
import { encodePng, extractImages } from "./extract-images";
import type { EngineFile } from "./types";

async function blankDoc(rotation = 0): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  if (rotation) page.setRotation(degrees(rotation));
  return { name: "doc.pdf", data: await doc.save(), mime: "application/pdf" };
}

describe("edit-metadata op", () => {
  it("sets title/author/subject/keywords", async () => {
    const [out] = await editMetadata([await blankDoc()], {
      title: "My Report",
      author: "Jane",
      subject: "Q3",
      keywords: "finance, quarterly, 2026",
    });
    const doc = await PDFDocument.load(out.data);
    expect(doc.getTitle()).toBe("My Report");
    expect(doc.getAuthor()).toBe("Jane");
    expect(doc.getSubject()).toBe("Q3");
    expect(doc.getKeywords()).toContain("finance");
    expect(doc.getKeywords()).toContain("quarterly");
  });

  it("clears a field set to empty string", async () => {
    const src = await PDFDocument.create();
    src.addPage([100, 100]);
    src.setTitle("old");
    const [out] = await editMetadata(
      [{ name: "d.pdf", data: await src.save(), mime: "application/pdf" }],
      { title: "" },
    );
    expect((await PDFDocument.load(out.data)).getTitle() ?? "").toBe("");
  });
});

describe("crop op", () => {
  it("sets the crop box from a displayed-space box (rotation 0)", async () => {
    const [out] = await crop([await blankDoc()], {
      box: { x: 50, y: 40, w: 100, h: 20 },
    });
    const page = (await PDFDocument.load(out.data)).getPage(0);
    const cb = page.getCropBox();
    // Displayed (50,40,100,20) on a 400x600 page → bottom-left (50,540,100,20).
    expect(cb.x).toBeCloseTo(50, 1);
    expect(cb.y).toBeCloseTo(540, 1);
    expect(cb.width).toBeCloseTo(100, 1);
    expect(cb.height).toBeCloseTo(20, 1);
  });

  it("maps the crop box through page rotation (90)", async () => {
    const [out] = await crop([await blankDoc(90)], {
      box: { x: 50, y: 40, w: 100, h: 20 },
    });
    const page = (await PDFDocument.load(out.data)).getPage(0);
    const cb = page.getCropBox();
    // Per page-rotate: displayed (50,40,100,20) at rot 90 → (40,50,20,100).
    expect(cb.x).toBeCloseTo(40, 1);
    expect(cb.y).toBeCloseTo(50, 1);
    expect(cb.width).toBeCloseTo(20, 1);
    expect(cb.height).toBeCloseTo(100, 1);
  });
});

describe("encodePng", () => {
  it("produces a valid PNG with the right header", async () => {
    const w = 3;
    const h = 2;
    const rgb = new Uint8Array(w * h * 3).fill(128);
    const png = encodePng(rgb, w, h, 3);
    // PNG signature.
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // IHDR dimensions live at bytes 16..24.
    const dv = new DataView(png.buffer, png.byteOffset);
    expect(dv.getUint32(16)).toBe(w);
    expect(dv.getUint32(20)).toBe(h);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(2); // color type RGB
  });
});

describe("extract-images op", () => {
  it("extracts an embedded PNG image", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    // A 4x4 red PNG built with our own encoder → embedded by pdf-lib.
    const px = new Uint8Array(4 * 4 * 3);
    for (let i = 0; i < px.length; i += 3) px[i] = 255;
    const png = encodePng(px, 4, 4, 3);
    const img = await doc.embedPng(png);
    page.drawImage(img, { x: 10, y: 10, width: 50, height: 50 });
    const src: EngineFile = { name: "img.pdf", data: await doc.save(), mime: "application/pdf" };

    const outputs = await extractImages([src], {});
    expect(outputs.length).toBeGreaterThanOrEqual(1);
    expect(outputs[0].mime === "image/png" || outputs[0].mime === "image/jpeg").toBe(true);
  });

  it("throws a friendly error when there are no images", async () => {
    await expect(extractImages([await blankDoc()], {})).rejects.toThrow(/No extractable images/);
  });
});
