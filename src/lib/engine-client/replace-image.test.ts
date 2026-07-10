import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { encodePng } from "./extract-images";
import { detectImages } from "./image-detect";
import { replaceImage } from "./pdflib-ops";
import type { EngineFile } from "./types";

function solidPng(size: number, channel: 0 | 1 | 2): Uint8Array {
  const px = new Uint8Array(size * size * 3);
  for (let i = 0; i < px.length; i += 3) px[i + channel] = 255;
  return encodePng(px, size, size, 3);
}

async function docWithImage(size: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const img = await doc.embedPng(solidPng(size, 0)); // red
  page.drawImage(img, { x: 20, y: 20, width: 80, height: 80 });
  return doc.save();
}

describe("detectImages", () => {
  it("lists embedded images with size and draw sites", async () => {
    const images = await detectImages(await docWithImage(4));
    expect(images).toHaveLength(1);
    expect(images[0].width).toBe(4);
    expect(images[0].height).toBe(4);
    expect(images[0].sites[0].page).toBe(0);
    expect(images[0].previewDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("returns [] for a PDF with no images", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    expect(await detectImages(await doc.save())).toEqual([]);
  });
});

describe("replace-image op", () => {
  it("swaps the image at its sites (new image present in output)", async () => {
    const src: EngineFile = { name: "d.pdf", data: await docWithImage(4), mime: "application/pdf" };
    const images = await detectImages(src.data);
    const bigger = solidPng(8, 2); // blue, different size
    const dataUrl = `data:image/png;base64,${Buffer.from(bigger).toString("base64")}`;

    const [out] = await replaceImage([src], {
      replacements: [{ sites: images[0].sites, dataUrl }],
    });

    // The drawn image is now the 8×8 replacement.
    const after = await detectImages(out.data);
    expect(after).toHaveLength(1);
    expect(after[0].width).toBe(8);
    expect(after[0].height).toBe(8);
  });

  it("leaves the PDF unchanged when there are no replacements", async () => {
    const src: EngineFile = { name: "d.pdf", data: await docWithImage(4), mime: "application/pdf" };
    const [out] = await replaceImage([src], { replacements: [] });
    const after = await detectImages(out.data);
    expect(after[0].width).toBe(4);
  });
});
