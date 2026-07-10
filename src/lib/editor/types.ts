/**
 * Overlay items placed on top of PDF pages by the edit/sign tools.
 *
 * Coordinates are in PDF points with the origin at the TOP-LEFT of the page,
 * in DISPLAYED (rotation-aware) orientation — the same space pdfjs' viewport
 * renders, natural for CSS positioning. The flatten step converts to PDF's
 * bottom-left, unrotated space via page-rotate.ts, so overlays, form fields,
 * and inline text edits all land correctly on pages with a /Rotate entry.
 */

interface OverlayBase {
  id: string;
  /** Zero-based page index. */
  page: number;
  x: number;
  y: number;
}

export interface TextItem extends OverlayBase {
  kind: "text";
  text: string;
  fontSize: number;
  /** Hex color like "#d92626". */
  color: string;
}

export interface RectItem extends OverlayBase {
  kind: "rect";
  w: number;
  h: number;
  color: string;
  /** true = filled box, false = outline only */
  fill: boolean;
  opacity: number;
}

export interface HighlightItem extends OverlayBase {
  kind: "highlight";
  w: number;
  h: number;
}

export interface ImageItem extends OverlayBase {
  kind: "image";
  w: number;
  h: number;
  /** PNG or JPEG data URL. */
  dataUrl: string;
}

/**
 * An edit to EXISTING document text: the original line (at x/y/w/h, with the
 * given baseline) is removed from the page content and newText is drawn in
 * its place. Produced by the "Edit text" mode; the flatten op consumes it.
 */
export interface TextEditItem extends OverlayBase {
  kind: "text-edit";
  w: number;
  h: number;
  /** Baseline in PDF points measured from the page TOP. */
  baseline: number;
  originalText: string;
  newText: string;
  fontSize: number;
  fontFamily: "sans" | "serif";
  bold: boolean;
  italic: boolean;
  /** Sampled text color (hex). */
  color: string;
  /** Sampled background color (hex) — used by the cover fallback and the UI. */
  bgColor: string;
  /** UI-only styling hint (the pdfjs-loaded face); ignored by the worker. */
  cssFontFamily: string;
  /** Set by the verification pass to force cover mode for this line. */
  forceCover?: boolean;
}

/** Straight line, optionally with an arrowhead at the (x2, y2) end. */
export interface LineItem extends OverlayBase {
  kind: "line";
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  arrow: boolean;
}

export interface EllipseItem extends OverlayBase {
  kind: "ellipse";
  w: number;
  h: number;
  color: string;
  fill: boolean;
  opacity: number;
}

/** Freehand pen stroke; points are relative to (x, y), the bbox top-left. */
export interface PathItem extends OverlayBase {
  kind: "path";
  w: number;
  h: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

/**
 * An interactive AcroForm field (text/checkbox/radio/dropdown) detected in the
 * document. x/y/w/h are the widget rect. On export the flatten op applies the
 * value via pdf-lib's form API rather than drawing anything. Radio groups are
 * modelled as one item per widget sharing `fieldName`: `value` holds the group's
 * selected export string, `exportValue` this widget's own on-state value.
 */
export interface FormFieldItem extends OverlayBase {
  kind: "form-field";
  w: number;
  h: number;
  /** Fully-qualified AcroField name. */
  fieldName: string;
  fieldType: "text" | "checkbox" | "radio" | "dropdown";
  /** text/dropdown → string; checkbox → boolean; radio → selected export string. */
  value: string | boolean;
  /** dropdown choices / radio export values (parallel to displayOptions). */
  options?: string[];
  /** Human-readable labels for dropdown choices (falls back to options). */
  displayOptions?: string[];
  /** This widget's on-state value (checkbox/radio). */
  exportValue?: string;
  multiline?: boolean;
  readOnly?: boolean;
}

export type OverlayItem =
  | TextItem
  | RectItem
  | HighlightItem
  | ImageItem
  | TextEditItem
  | LineItem
  | EllipseItem
  | PathItem
  | FormFieldItem;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

let nextId = 1;
export function newItemId(): string {
  return `item-${nextId++}`;
}
