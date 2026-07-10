import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { drawAngle, pageRotation, toPdfPoint, toPdfRect } from "./page-rotate";

async function pageAt(rotation: number) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]); // Wu=400, Hu=600
  page.setRotation(degrees(rotation));
  return page;
}

describe("page-rotate helpers", () => {
  it("maps a displayed point to unrotated PDF space at each rotation", async () => {
    // displayed (50,40) with Wu=400, Hu=600
    expect(toPdfPoint(await pageAt(0), 50, 40)).toEqual({ x: 50, y: 560 });
    expect(toPdfPoint(await pageAt(90), 50, 40)).toEqual({ x: 40, y: 50 });
    expect(toPdfPoint(await pageAt(180), 50, 40)).toEqual({ x: 350, y: 40 });
    expect(toPdfPoint(await pageAt(270), 50, 40)).toEqual({ x: 360, y: 550 });
  });

  it("maps a displayed box to an unrotated bounding box (w/h swap at 90/270)", async () => {
    expect(toPdfRect(await pageAt(0), 50, 40, 100, 20)).toEqual({ x: 50, y: 540, width: 100, height: 20 });
    expect(toPdfRect(await pageAt(90), 50, 40, 100, 20)).toEqual({ x: 40, y: 50, width: 20, height: 100 });
    expect(toPdfRect(await pageAt(180), 50, 40, 100, 20)).toEqual({ x: 250, y: 40, width: 100, height: 20 });
    expect(toPdfRect(await pageAt(270), 50, 40, 100, 20)).toEqual({ x: 340, y: 450, width: 20, height: 100 });
  });

  it("reports rotation and draw angle", async () => {
    expect(pageRotation(await pageAt(90))).toBe(90);
    expect(pageRotation(await pageAt(450))).toBe(90); // normalized
    expect(pageRotation(await pageAt(-90))).toBe(270);
    expect(drawAngle(await pageAt(270)).angle).toBe(270);
  });
});
