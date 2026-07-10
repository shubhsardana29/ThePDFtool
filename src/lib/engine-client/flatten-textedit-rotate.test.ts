import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import type { TextEditItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import { setFontFetcher } from "./font-match";
import { detectTextLines } from "./text-detect";
import type { EngineFile } from "./types";
import type { PdfjsDocument } from "./render";

beforeAll(() => {
  setFontFetcher(async (file) =>
    new Uint8Array(await readFile(path.join(process.cwd(), "public/fonts", file))),
  );
});

async function loadPdfjs(data: Uint8Array): Promise<PdfjsDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return (await pdfjs.getDocument({ data: data.slice() }).promise) as unknown as PdfjsDocument;
}

async function extractStrings(data: Uint8Array): Promise<string> {
  const doc = await loadPdfjs(data);
  const tc = await (await doc.getPage(1)).getTextContent();
  const s = tc.items
    .filter((i) => "str" in i && !!(i as { str: string }).str.trim())
    .map((i) => (i as { str: string }).str)
    .join(" ");
  await doc.loadingTask.destroy();
  return s;
}

/** A /Rotate 90 page with one line that reads upright in the display. */
async function rotatedDoc(): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, 800]);
  page.setRotation(degrees(90));
  page.drawText("Original 450 USD", { x: 100, y: 300, size: 14, font, rotate: degrees(90) });
  page.drawText("Keep this line", { x: 140, y: 300, size: 14, font, rotate: degrees(90) });
  return { name: "rot.pdf", data: await doc.save(), mime: "application/pdf" };
}

describe("inline text edit on a rotated page", () => {
  it("removes the original and draws the replacement upright", async () => {
    const src = await rotatedDoc();

    // Detect exactly as the editor does, in displayed space.
    const doc = await loadPdfjs(src.data);
    const lines = await detectTextLines(doc, 0);
    await doc.loadingTask.destroy();
    const target = lines.find((l) => l.text.includes("Original 450 USD"));
    expect(target).toBeDefined();

    const item: TextEditItem = {
      id: "e1",
      kind: "text-edit",
      page: 0,
      x: target!.x,
      y: target!.y,
      w: target!.w,
      h: target!.h,
      baseline: target!.baseline,
      originalText: target!.text,
      newText: "Original 199 USD",
      fontSize: target!.fontSize,
      fontFamily: target!.fontFamily,
      bold: target!.bold,
      italic: target!.italic,
      color: "#000000",
      bgColor: "#ffffff",
      cssFontFamily: target!.cssFontFamily,
    };

    const [out] = await flatten([src], { items: [item] });
    const strings = await extractStrings(out.data);

    // Original removed, replacement present, neighbour untouched.
    expect(strings).not.toContain("450");
    expect(strings).toContain("Original 199 USD");
    expect(strings).toContain("Keep this line");

    // The replacement is still readable (horizontal) in the display: detect
    // again and confirm it comes back as one horizontal line.
    const doc2 = await loadPdfjs(out.data);
    const lines2 = await detectTextLines(doc2, 0);
    await doc2.loadingTask.destroy();
    expect(lines2.some((l) => l.text.includes("Original 199 USD"))).toBe(true);
  });
});
