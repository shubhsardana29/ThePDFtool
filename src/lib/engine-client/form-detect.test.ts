import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { detectFormFields } from "./form-detect";

/**
 * Build a one-page PDF with one of each supported field kind. Widget rects use
 * the standard bottom-left origin; detection converts them to top-left points.
 */
async function formFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  const name = form.createTextField("full_name");
  name.setText("Prefilled");
  name.addToPage(page, { x: 100, y: 700, width: 200, height: 20 });

  const agree = form.createCheckBox("agree");
  agree.addToPage(page, { x: 100, y: 650, width: 16, height: 16 });

  const color = form.createRadioGroup("color");
  color.addOptionToPage("red", page, { x: 100, y: 600, width: 16, height: 16 });
  color.addOptionToPage("blue", page, { x: 140, y: 600, width: 16, height: 16 });

  const country = form.createDropdown("country");
  country.addOptions(["US", "UK"]);
  country.addToPage(page, { x: 100, y: 550, width: 120, height: 20 });

  return doc.save();
}

async function pdfjsDoc(data: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs.getDocument({ data: data.slice() }).promise;
}

describe("detectFormFields", () => {
  it("detects each supported field kind with geometry and values", async () => {
    const doc = await pdfjsDoc(await formFixture());
    const fields = await detectFormFields(doc as never, 0);
    await doc.loadingTask.destroy();

    const byName = (n: string) => fields.filter((f) => f.fieldName === n);

    const text = byName("full_name")[0];
    expect(text?.fieldType).toBe("text");
    expect(text?.value).toBe("Prefilled");
    // Top-left origin: rect top was y=720 on an 800pt page (±1pt for widget border).
    expect(Math.abs((text?.y ?? 0) - 80)).toBeLessThanOrEqual(1);
    expect(Math.abs((text?.w ?? 0) - 200)).toBeLessThanOrEqual(1);

    const check = byName("agree")[0];
    expect(check?.fieldType).toBe("checkbox");
    expect(check?.value).toBe(false);

    const radios = byName("color");
    expect(radios).toHaveLength(2);
    expect(radios.every((r) => r.fieldType === "radio")).toBe(true);
    expect(radios.map((r) => r.exportValue).sort()).toEqual(["blue", "red"]);

    const dropdown = byName("country")[0];
    expect(dropdown?.fieldType).toBe("dropdown");
    expect(dropdown?.options).toEqual(["US", "UK"]);
  });

  it("returns no fields for a PDF without a form", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]).drawText("plain document");
    const pdfjs = await pdfjsDoc(await doc.save());
    const fields = await detectFormFields(pdfjs as never, 0);
    await pdfjs.loadingTask.destroy();
    expect(fields).toEqual([]);
  });
});
