/**
 * Detection of interactive AcroForm fields for the "Fill Form" tool.
 *
 * Reads pdfjs Widget annotations off the already-loaded document (the same
 * pdfjs doc the editor uses for text detection) and maps each field's rect
 * into PDF points with a TOP-LEFT origin — the same convention as OverlayItem.
 * The tool seeds one FormFieldItem per detected widget; the flatten op fills
 * them via pdf-lib's form API on export.
 */
import type { PdfjsDocument } from "./render";

export interface DetectedField {
  page: number;
  fieldName: string;
  fieldType: "text" | "checkbox" | "radio" | "dropdown";
  x: number;
  y: number;
  w: number;
  h: number;
  /** text/dropdown → string; checkbox → boolean; radio → selected export string. */
  value: string | boolean;
  /** dropdown choices / radio export values (parallel to displayOptions). */
  options?: string[];
  displayOptions?: string[];
  /** This widget's on-state value (checkbox/radio). */
  exportValue?: string;
  multiline?: boolean;
  readOnly?: boolean;
}

/** The subset of pdfjs' (loosely typed) annotation object we rely on. */
interface WidgetAnnotation {
  subtype?: string;
  fieldType?: string; // "Tx" | "Btn" | "Ch" | "Sig" | ...
  fieldName?: string;
  fieldValue?: string | string[] | null;
  rect?: [number, number, number, number];
  readOnly?: boolean;
  hidden?: boolean;
  // text
  multiLine?: boolean;
  // button (checkbox / radio / push)
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  /** Checkbox on-state value (pdfjs). */
  exportValue?: string;
  /** Radio widget on-state value (pdfjs uses this key for radios). */
  buttonValue?: string;
  // choice (dropdown / listbox)
  combo?: boolean;
  options?: { exportValue: string; displayValue: string }[];
}

export async function detectFormFields(
  doc: PdfjsDocument,
  pageIndex: number,
): Promise<DetectedField[]> {
  const page = await doc.getPage(pageIndex + 1);
  // Map widget rects into DISPLAYED (rotation-aware) space via the viewport, so
  // fields land in the right place on pages with a /Rotate entry too.
  const viewport = page.getViewport({ scale: 1 });
  const annotations = (await page.getAnnotations()) as WidgetAnnotation[];

  const fields: DetectedField[] = [];
  for (const a of annotations) {
    if (a.subtype !== "Widget" || !a.fieldName || !a.rect) continue;
    if (a.hidden) continue;

    // Widget rect: [x1, y1, x2, y2] in unrotated PDF space (bottom-left). Map
    // both corners into displayed (top-left) space; the viewport handles
    // rotation, so the box stays axis-aligned at any /Rotate.
    const [x1, y1, x2, y2] = a.rect;
    const [ax, ay] = viewport.convertToViewportPoint(x1, y1);
    const [bx, by] = viewport.convertToViewportPoint(x2, y2);
    const geom = {
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      w: Math.abs(bx - ax),
      h: Math.abs(by - ay),
    };
    if (geom.w <= 0 || geom.h <= 0) continue;

    const base = {
      page: pageIndex,
      fieldName: a.fieldName,
      readOnly: a.readOnly ?? false,
      ...geom,
    };

    switch (a.fieldType) {
      case "Tx":
        fields.push({
          ...base,
          fieldType: "text",
          value: typeof a.fieldValue === "string" ? a.fieldValue : "",
          multiline: a.multiLine ?? false,
        });
        break;
      case "Btn": {
        if (a.pushButton) break; // push buttons hold no value
        // pdfjs reports the widget on-state as buttonValue for radios and
        // exportValue for checkboxes.
        const onState = a.buttonValue ?? a.exportValue ?? "";
        const current = typeof a.fieldValue === "string" ? a.fieldValue : "";
        if (a.radioButton) {
          fields.push({
            ...base,
            fieldType: "radio",
            exportValue: onState,
            value: current, // group's selected export value
          });
        } else {
          // checkBox (default for non-radio, non-push buttons)
          fields.push({
            ...base,
            fieldType: "checkbox",
            exportValue: onState,
            value: !!current && current !== "Off",
          });
        }
        break;
      }
      case "Ch": {
        if (!a.combo) break; // listboxes (multi-select) are out of scope for v1
        const opts = a.options ?? [];
        fields.push({
          ...base,
          fieldType: "dropdown",
          options: opts.map((o) => o.exportValue),
          displayOptions: opts.map((o) => o.displayValue || o.exportValue),
          value:
            typeof a.fieldValue === "string"
              ? a.fieldValue
              : Array.isArray(a.fieldValue)
                ? (a.fieldValue[0] ?? "")
                : "",
        });
        break;
      }
      // "Sig" and everything else: unsupported in v1.
    }
  }
  return fields;
}
