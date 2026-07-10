/**
 * Draw replacement text using a font ALREADY EMBEDDED in the document, so an
 * edited line keeps the document's real typeface instead of a substitute.
 *
 * Supported:
 *  - simple Type1/TrueType fonts with WinAnsi-compatible encodings
 *    (coverage-checked against /Widths when the font is subsetted)
 *  - Type0 / Identity-H composite fonts with an embedded TrueType program
 *    (codepoints mapped to glyph IDs via fontkit, coverage-checked)
 *
 * Anything else returns null and the caller falls back to Liberation.
 */
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  beginText,
  decodePDFRawStream,
  endText,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  rotateAndSkewTextDegreesAndTranslate,
  setFillingRgbColor,
  setFontAndSize,
  showText,
  type PDFPage,
} from "pdf-lib";
import { hexToRgb } from "@/lib/editor/types";
import { fontDictFor } from "./content-edit";

interface Fontkit {
  create(data: Uint8Array): {
    glyphForCodePoint(cp: number): { id: number } | null | undefined;
  };
}

export interface PreparedNativeText {
  resName: string;
  hex: string;
}

// WinAnsi codes for characters that differ from Latin-1 (the common ones).
const WINANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85, // …
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98,
  0x2122: 0x99, // ™
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function winAnsiEncode(text: string): number[] | null {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) out.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) out.push(cp);
    else if (WINANSI_EXTRA[cp] !== undefined) out.push(WINANSI_EXTRA[cp]);
    else return null;
  }
  return out;
}

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function num(v: unknown): number | null {
  return v instanceof PDFNumber ? v.asNumber() : null;
}

/** Accept /WinAnsiEncoding, absent encoding, or a dict without Differences. */
function encodingIsWinAnsiCompatible(font: PDFDict): boolean {
  const enc = font.lookup(PDFName.of("Encoding"));
  if (!enc) return true;
  const name = enc.toString();
  if (name === "/WinAnsiEncoding") return true;
  if (enc instanceof PDFDict) {
    if (enc.lookup(PDFName.of("Differences"))) return false;
    const base = enc.lookup(PDFName.of("BaseEncoding"))?.toString();
    return base === undefined || base === "/WinAnsiEncoding";
  }
  return false;
}

function trySimpleFont(font: PDFDict, text: string): string | null {
  const subtype = font.lookup(PDFName.of("Subtype"))?.toString();
  if (subtype !== "/Type1" && subtype !== "/TrueType") return null;
  if (!encodingIsWinAnsiCompatible(font)) return null;
  const bytes = winAnsiEncode(text);
  if (!bytes) return null;

  // Coverage: subsetted/partial fonts carry /Widths — a zero or out-of-range
  // width means the glyph likely isn't in the font. Standard-14 fonts
  // (no /Widths) cover all of WinAnsi.
  const firstChar = num(font.lookup(PDFName.of("FirstChar")));
  const widths = font.lookup(PDFName.of("Widths"));
  if (firstChar !== null && widths instanceof PDFArray) {
    for (const b of bytes) {
      if (b === 0x20) continue; // space renders even at width 0 entries
      const idx = b - firstChar;
      if (idx < 0 || idx >= widths.size()) return null;
      const w = num(widths.lookup(idx));
      if (!w) return null;
    }
  }
  return toHex(bytes);
}

function tryType0Font(font: PDFDict, text: string, fontkit: Fontkit): string | null {
  if (font.lookup(PDFName.of("Encoding"))?.toString() !== "/Identity-H") return null;
  const descendants = font.lookup(PDFName.of("DescendantFonts"));
  if (!(descendants instanceof PDFArray) || descendants.size() === 0) return null;
  const desc = descendants.lookup(0);
  if (!(desc instanceof PDFDict)) return null;

  // Identity-H codes are glyph IDs only when CIDToGIDMap is Identity.
  const cidToGid = desc.lookup(PDFName.of("CIDToGIDMap"));
  if (cidToGid && cidToGid.toString() !== "/Identity") return null;

  const descriptor = desc.lookup(PDFName.of("FontDescriptor"));
  if (!(descriptor instanceof PDFDict)) return null;
  const fontFile = descriptor.lookup(PDFName.of("FontFile2"));
  if (!(fontFile instanceof PDFRawStream)) return null;

  let glyphs: number[];
  try {
    const program = fontkit.create(decodePDFRawStream(fontFile).decode());
    glyphs = [];
    for (const ch of text) {
      const glyph = program.glyphForCodePoint(ch.codePointAt(0)!);
      if (!glyph || !glyph.id) return null; // not in the (subset) font
      glyphs.push(glyph.id);
    }
  } catch {
    return null;
  }
  const bytes: number[] = [];
  for (const gid of glyphs) {
    if (gid > 0xffff) return null;
    bytes.push(gid >> 8, gid & 0xff);
  }
  return toHex(bytes);
}

/**
 * Work out whether `text` can be shown with the page's font resource
 * `resName`. Returns the encoded hex string on success.
 */
export function prepareNativeText(
  page: PDFPage,
  resName: string,
  text: string,
  fontkit: Fontkit,
): PreparedNativeText | null {
  try {
    const font = fontDictFor(page, resName);
    if (!font) return null;
    const hex = trySimpleFont(font, text) ?? tryType0Font(font, text, fontkit);
    return hex ? { resName, hex } : null;
  } catch {
    return null;
  }
}

/**
 * Show prepared text at (x, baselineY) — PDF bottom-left origin points. On a
 * rotated page, pass `rotate` (0/90/180/270) so the text reads upright in the
 * display, matching how flatten rotates every other drawn overlay.
 */
export function drawNativeText(
  page: PDFPage,
  prepared: PreparedNativeText,
  opts: { x: number; baselineY: number; size: number; colorHex: string; rotate?: number },
): void {
  const { r, g, b } = hexToRgb(opts.colorHex);
  const rot = ((opts.rotate ?? 0) % 360 + 360) % 360;
  // Rotation 0 keeps the plain Td move so un-rotated output is unchanged.
  const positionOp =
    rot === 0
      ? moveText(opts.x, opts.baselineY)
      : rotateAndSkewTextDegreesAndTranslate(rot, 0, 0, opts.x, opts.baselineY);
  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFillingRgbColor(r, g, b),
    setFontAndSize(PDFName.of(prepared.resName), opts.size),
    positionOp,
    showText(PDFHexString.of(prepared.hex)),
    endText(),
    popGraphicsState(),
  );
}
