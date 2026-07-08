/**
 * Overlay items placed on top of PDF pages by the edit/sign tools.
 *
 * Coordinates are in PDF points with the origin at the TOP-LEFT of the page
 * (natural for CSS positioning); the flatten step converts to PDF's
 * bottom-left origin. Pages with a /Rotate entry are not adjusted for — v1
 * limitation.
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

export type OverlayItem =
  | TextItem
  | RectItem
  | HighlightItem
  | ImageItem
  | TextEditItem
  | LineItem
  | EllipseItem
  | PathItem;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

let nextId = 1;
export function newItemId(): string {
  return `item-${nextId++}`;
}
