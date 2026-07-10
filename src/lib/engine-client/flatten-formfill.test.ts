import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { FormFieldItem } from "@/lib/editor/types";
import { flatten } from "./flatten";
import type { EngineFile } from "./types";

async function formFixture(): Promise<EngineFile> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  form
    .createTextField("full_name")
    .addToPage(page, { x: 100, y: 700, width: 200, height: 20 });
  form
    .createCheckBox("agree")
    .addToPage(page, { x: 100, y: 650, width: 16, height: 16 });
  const color = form.createRadioGroup("color");
  color.addOptionToPage("red", page, { x: 100, y: 600, width: 16, height: 16 });
  color.addOptionToPage("blue", page, { x: 140, y: 600, width: 16, height: 16 });
  const country = form.createDropdown("country");
  country.addOptions(["US", "UK"]);
  country.addToPage(page, { x: 100, y: 550, width: 120, height: 20 });

  return { name: "form.pdf", data: await doc.save(), mime: "application/pdf" };
}

function field(overrides: Partial<FormFieldItem> & { fieldName: string; fieldType: FormFieldItem["fieldType"]; value: string | boolean }): FormFieldItem {
  return {
    id: `f-${overrides.fieldName}`,
    kind: "form-field",
    page: 0,
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    ...overrides,
  };
}

const filledItems: FormFieldItem[] = [
  field({ fieldName: "full_name", fieldType: "text", value: "Jane Doe" }),
  field({ fieldName: "agree", fieldType: "checkbox", value: true }),
  field({ fieldName: "color", fieldType: "radio", value: "blue", exportValue: "blue" }),
  field({ fieldName: "country", fieldType: "dropdown", value: "UK", options: ["US", "UK"] }),
];

describe("flatten with form-field items", () => {
  it("fills every field and keeps the form interactive by default", async () => {
    const [out] = await flatten([await formFixture()], { items: filledItems });
    const doc = await PDFDocument.load(out.data);
    const form = doc.getForm();

    expect(form.getTextField("full_name").getText()).toBe("Jane Doe");
    expect(form.getCheckBox("agree").isChecked()).toBe(true);
    expect(form.getRadioGroup("color").getSelected()).toBe("blue");
    expect(form.getDropdown("country").getSelected()).toEqual(["UK"]);
    // Still interactive.
    expect(form.getFields().length).toBeGreaterThan(0);
  });

  it("flattens the form when flattenForms is set (fields removed)", async () => {
    const [out] = await flatten([await formFixture()], {
      items: filledItems,
      flattenForms: true,
    });
    const doc = await PDFDocument.load(out.data);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("never throws on an unresolvable field name", async () => {
    const [out] = await flatten([await formFixture()], {
      items: [field({ fieldName: "does_not_exist", fieldType: "text", value: "x" })],
    });
    // Export still succeeds and the real fields remain untouched.
    const doc = await PDFDocument.load(out.data);
    expect(doc.getForm().getTextField("full_name").getText()).toBeUndefined();
  });
});
