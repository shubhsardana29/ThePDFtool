import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { OverlayItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import type { EngineFile } from "./types";

async function rotatedFixture(rotation: number): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 600]); // Wu=400, Hu=600
  page.setRotation(degrees(rotation));
  // A marker that already reads correctly in the display, so we can confirm the
  // page truly renders rotated in pdfjs.
  page.drawText("orig", { x: 20, y: 20, size: 10, font });
  return { name: "r.pdf", data: await doc.save(), mime: "application/pdf" };
}

/**
 * Reload the output, find our stamped text, and return where it lands in
 * DISPLAYED (viewport) space plus its advance direction. The whole point of
 * rotation support: text placed at displayed (X,Y) ends up at displayed (X,Y),
 * reading horizontally, regardless of /Rotate.
 */
async function locate(data: Uint8Array, needle: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pd = await pdfjs.getDocument({ data: data.slice() }).promise;
  const p = await pd.getPage(1);
  const vp = p.getViewport({ scale: 1 });
  const tc = await p.getTextContent();
  const item = tc.items.find(
    (i) => "str" in i && (i as { str: string }).str.includes(needle),
  ) as { transform: number[] } | undefined;
  let res: { x: number; y: number; adv: [number, number] } | null = null;
  if (item) {
    const [vx, vy] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
    const [ax, ay] = vp.convertToViewportPoint(
      item.transform[4] + item.transform[0],
      item.transform[5] + item.transform[1],
    );
    res = { x: vx, y: vy, adv: [Math.round(ax - vx), Math.round(ay - vy)] };
  }
  await pd.loadingTask.destroy();
  return res;
}

describe("flatten places overlays correctly on rotated pages", () => {
  for (const rotation of [0, 90, 180, 270]) {
    it(`stamps text at the intended displayed position (rotate=${rotation})`, async () => {
      // Place text with its baseline at displayed (60, 100).
      const items: OverlayItem[] = [
        {
          id: "t1",
          kind: "text",
          page: 0,
          x: 60,
          y: 100 - 16 * 0.85, // drawText offsets baseline by size*0.85 from item.y
          text: "PLACED",
          fontSize: 16,
          color: "#000000",
        },
      ];
      const [out] = await flatten([await rotatedFixture(rotation)], { items });
      const loc = await locate(out.data, "PLACED");
      expect(loc).not.toBeNull();
      // Lands where we placed it in displayed space (±2pt for glyph metrics).
      expect(Math.abs(loc!.x - 60)).toBeLessThanOrEqual(2);
      expect(Math.abs(loc!.y - 100)).toBeLessThanOrEqual(2);
      // Reads horizontally, left-to-right, in the display.
      expect(loc!.adv[0]).toBeGreaterThan(0);
      expect(Math.abs(loc!.adv[1])).toBeLessThanOrEqual(1);
    });
  }
});
