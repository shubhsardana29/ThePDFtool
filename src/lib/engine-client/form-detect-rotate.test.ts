import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { FormFieldItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import { detectFormFields } from "./form-detect";
import type { EngineFile } from "./types";

async function rotatedForm(rotation: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]); // Wu=400, Hu=600
  page.setRotation(degrees(rotation));
  doc
    .getForm()
    .createTextField("full_name")
    .addToPage(page, { x: 100, y: 500, width: 200, height: 20 });
  return doc.save();
}

describe("form detection + fill on rotated pages", () => {
  it("detects the field within displayed bounds at rotate=90", async () => {
    const data = await rotatedForm(90);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
    const fields = await detectFormFields(doc as never, 0);
    await doc.loadingTask.destroy();

    expect(fields).toHaveLength(1);
    const f = fields[0];
    expect(f.fieldName).toBe("full_name");
    // Displayed page for rotate=90 is 600 wide x 400 tall — the field box must
    // fall inside it (proves the viewport mapping ran, not the raw rect).
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.x + f.w).toBeLessThanOrEqual(600 + 1);
    expect(f.y + f.h).toBeLessThanOrEqual(400 + 1);
  });

  it("fills the field on a rotated page (value survives export)", async () => {
    const src: EngineFile = {
      name: "form.pdf",
      data: await rotatedForm(270),
      mime: "application/pdf",
    };
    const item: FormFieldItem = {
      id: "f1",
      kind: "form-field",
      page: 0,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      fieldName: "full_name",
      fieldType: "text",
      value: "Rotated Jane",
    };
    const [out] = await flatten([src], { items: [item] });
    const doc = await PDFDocument.load(out.data);
    expect(doc.getForm().getTextField("full_name").getText()).toBe("Rotated Jane");
  });
});
