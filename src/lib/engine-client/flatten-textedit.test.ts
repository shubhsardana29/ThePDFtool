import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import type { TextEditItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import { setFontFetcher } from "./font-match";
import type { EngineFile } from "./types";

beforeAll(() => {
  // In the browser fonts come from /fonts/*; in Node read them from public/.
  setFontFetcher(async (file) =>
    new Uint8Array(await readFile(path.join(process.cwd(), "public/fonts", file))),
  );
});

async function extractStrings(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const strs = tc.items
    .filter((i): i is { str: string } & typeof i => "str" in i && !!i.str.trim())
    .map((i) => (i as { str: string }).str);
  await doc.loadingTask.destroy();
  return strs;
}

function editItem(overrides: Partial<TextEditItem> = {}): TextEditItem {
  return {
    id: "e1",
    kind: "text-edit",
    page: 0,
    x: 72,
    y: 88,
    w: 120,
    h: 16,
    baseline: 100, // pageH 800 − drawText y 700
    originalText: "Total due: 450 USD",
    newText: "Total due: 199 USD",
    fontSize: 14,
    fontFamily: "sans",
    bold: false,
    italic: false,
    color: "#111111",
    bgColor: "#ffffff",
    cssFontFamily: "sans-serif",
    ...overrides,
  };
}

async function fixture(): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, 800]);
  page.drawText("Total due: 450 USD", { x: 72, y: 700, size: 14, font });
  page.drawText("Keep this line", { x: 72, y: 660, size: 14, font });
  return { name: "doc.pdf", data: await doc.save(), mime: "application/pdf" };
}

describe("flatten with text-edit items (true removal)", () => {
  it("removes the original text and draws the replacement in Liberation Sans", async () => {
    const [out] = await flatten([await fixture()], { items: [editItem()] });
    const strings = await extractStrings(out.data);
    expect(strings.join(" ")).not.toContain("450");
    expect(strings.join(" ")).toContain("Total due: 199 USD");
    expect(strings.join(" ")).toContain("Keep this line");
  });

  it("embeds the font subsetted (output stays small)", async () => {
    const src = await fixture();
    const originalSize = src.data.length;
    const [out] = await flatten([src], { items: [editItem()] });
    // Full LiberationSans-Regular is ~400KB; a subset is a few KB.
    expect(out.data.length - originalSize).toBeLessThan(60 * 1024);
  });

  it("honors forceCover by drawing the background patch", async () => {
    const [out] = await flatten([await fixture()], {
      items: [editItem({ forceCover: true })],
    });
    const strings = await extractStrings(out.data);
    // Covered, not removed: original text still extractable underneath…
    expect(strings.join(" ")).toContain("450");
    // …and the replacement is drawn on top.
    expect(strings.join(" ")).toContain("199");
  });

  it("falls back to cover for text inside a Form XObject", async () => {
    const inner = await PDFDocument.create();
    const innerFont = await inner.embedFont(StandardFonts.Helvetica);
    inner
      .addPage([600, 800])
      .drawText("xobject text", { x: 72, y: 700, size: 14, font: innerFont });
    const outer = await PDFDocument.create();
    const [embedded] = await outer.embedPdf(await inner.save());
    outer.addPage([600, 800]).drawPage(embedded);
    const src: EngineFile = {
      name: "x.pdf",
      data: await outer.save(),
      mime: "application/pdf",
    };

    const [out] = await flatten([src], {
      items: [
        editItem({ originalText: "xobject text", newText: "replaced text", w: 90 }),
      ],
    });
    const strings = await extractStrings(out.data);
    // Removal can't reach into the XObject — replacement must still appear.
    expect(strings.join(" ")).toContain("replaced text");
  });
});
