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

export type OverlayItem = TextItem | RectItem | HighlightItem | ImageItem;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

let nextId = 1;
export function newItemId(): string {
  return `item-${nextId++}`;
}
