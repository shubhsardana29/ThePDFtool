/**
 * Page-rotation coordinate mapping for the editor.
 *
 * The editor UI works in DISPLAYED space: top-left origin, points, in the
 * orientation the reader sees — the same space pdfjs' rotation-aware viewport
 * renders and that overlay items store their x/y in. pdf-lib, however, draws in
 * UNROTATED PDF user space (bottom-left origin, ignoring /Rotate). These helpers
 * convert between the two so stamped content lands in the right place and reads
 * upright on pages with a /Rotate entry.
 *
 * Every function reduces to the plain `Hu - y` conversion when rotation is 0,
 * so un-rotated documents are unaffected.
 *
 * Mapping (Wu/Hu = unrotated media-box width/height; verified empirically):
 *   rot   displayed dims   displayed(xd,yd) → unrotated(xu,yu)   draw angle
 *   0     (Wu, Hu)         (xd,        Hu - yd)                   0°
 *   90    (Hu, Wu)         (yd,        xd)                        90°
 *   180   (Wu, Hu)         (Wu - xd,   yd)                        180°
 *   270   (Hu, Wu)         (Wu - yd,   Hu - xd)                   270°
 */
import { degrees, type Degrees, type PDFPage } from "pdf-lib";

export type Rotation = 0 | 90 | 180 | 270;

export function pageRotation(page: PDFPage): Rotation {
  const r = (((page.getRotation().angle % 360) + 360) % 360);
  return r === 90 || r === 180 || r === 270 ? r : 0;
}

/** pdf-lib rotate value so stamped content reads upright in the display. */
export function drawAngle(page: PDFPage): Degrees {
  return degrees(pageRotation(page));
}

/**
 * Map a point from DISPLAYED top-left space to UNROTATED PDF user space
 * (bottom-left origin) — the anchor to pass to pdf-lib draw calls.
 */
export function toPdfPoint(
  page: PDFPage,
  xd: number,
  yd: number,
): { x: number; y: number } {
  const Wu = page.getWidth();
  const Hu = page.getHeight();
  switch (pageRotation(page)) {
    case 90:
      return { x: yd, y: xd };
    case 180:
      return { x: Wu - xd, y: yd };
    case 270:
      return { x: Wu - yd, y: Hu - xd };
    default:
      return { x: xd, y: Hu - yd };
  }
}

/**
 * Map a displayed-space axis-aligned box (top-left xd/yd, size w/h) to an
 * unrotated bounding box (bottom-left origin). Because /Rotate is always a
 * multiple of 90°, the box stays axis-aligned; width/height swap at 90°/270°.
 */
export function toPdfRect(
  page: PDFPage,
  xd: number,
  yd: number,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  const c1 = toPdfPoint(page, xd, yd);
  const c2 = toPdfPoint(page, xd + w, yd + h);
  return {
    x: Math.min(c1.x, c2.x),
    y: Math.min(c1.y, c2.y),
    width: Math.abs(c2.x - c1.x),
    height: Math.abs(c2.y - c1.y),
  };
}
