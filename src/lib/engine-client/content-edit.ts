/**
 * True removal of existing text from PDF pages.
 *
 * Walks a page's content stream tracking graphics + text state, computes the
 * device-space start position of every show-text operator, matches those
 * against the edited lines' bounding boxes, and splices matched operators out
 * of the stream — preserving the layout of surviving text via TJ-advance
 * compensation when a following show op depends on the deleted advance.
 *
 * Pure pdf-lib module (no DOM): fully unit-testable in Node.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import {
  spliceStream,
  tokenizeContentStream,
  type OpRecord,
  type Operand,
  type StreamEdit,
} from "./content-stream";

export interface EditRegion {
  /** Top-left-origin PDF points (the OverlayItem convention). */
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
}

export interface RemovalResult {
  /** Per region: show ops removed (or advance-neutralized invisibly). */
  removed: number[];
  /** Per region: ops kept but made invisible (widths were uncomputable). */
  invisible: number[];
}

// ——— matrices (PDF row-vector convention: p' = p × M) ———

type Mat = [number, number, number, number, number, number];

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** first A, then B */
function concat(A: Mat, B: Mat): Mat {
  return [
    A[0] * B[0] + A[1] * B[2],
    A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2],
    A[2] * B[1] + A[3] * B[3],
    A[4] * B[0] + A[5] * B[2] + B[4],
    A[4] * B[1] + A[5] * B[3] + B[5],
  ];
}

function translate(tx: number, ty: number): Mat {
  return [1, 0, 0, 1, tx, ty];
}

function apply(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

// ——— font width tables ———

interface WidthTable {
  kind: "simple" | "cid2" | "type3";
  firstChar: number;
  widths: number[];
  missing: number;
  cidW: Map<number, number> | null;
  dw: number;
  /** glyph-space → text-space scale (0.001 except Type3). */
  scale: number;
}

function num(v: unknown): number | null {
  return v instanceof PDFNumber ? v.asNumber() : null;
}

function resolveWidthTable(font: PDFDict): WidthTable | null {
  const subtype = font.lookup(PDFName.of("Subtype"))?.toString();
  if (subtype === "/Type0") {
    const descendants = font.lookup(PDFName.of("DescendantFonts"));
    if (!(descendants instanceof PDFArray) || descendants.size() === 0) return null;
    const desc = descendants.lookup(0);
    if (!(desc instanceof PDFDict)) return null;
    // Only Identity-H 2-byte encodings are supported (the dominant case).
    const encoding = font.lookup(PDFName.of("Encoding"))?.toString();
    if (encoding !== "/Identity-H") return null;
    const dw = num(desc.lookup(PDFName.of("DW"))) ?? 1000;
    const cidW = new Map<number, number>();
    const w = desc.lookup(PDFName.of("W"));
    if (w instanceof PDFArray) {
      let i = 0;
      while (i < w.size()) {
        const c1 = num(w.lookup(i));
        if (c1 === null) break;
        const second = w.lookup(i + 1);
        if (second instanceof PDFArray) {
          for (let j = 0; j < second.size(); j++) {
            const width = num(second.lookup(j));
            if (width !== null) cidW.set(c1 + j, width);
          }
          i += 2;
        } else {
          const c2 = num(second);
          const width = num(w.lookup(i + 2));
          if (c2 === null || width === null) break;
          for (let c = c1; c <= c2; c++) cidW.set(c, width);
          i += 3;
        }
      }
    }
    return { kind: "cid2", firstChar: 0, widths: [], missing: dw, cidW, dw, scale: 0.001 };
  }

  const firstChar = num(font.lookup(PDFName.of("FirstChar")));
  const widthsArr = font.lookup(PDFName.of("Widths"));
  if (firstChar === null || !(widthsArr instanceof PDFArray)) return null;
  const widths: number[] = [];
  for (let i = 0; i < widthsArr.size(); i++) widths.push(num(widthsArr.lookup(i)) ?? 0);

  let scale = 0.001;
  if (subtype === "/Type3") {
    const fm = font.lookup(PDFName.of("FontMatrix"));
    const a = fm instanceof PDFArray ? num(fm.lookup(0)) : null;
    if (a === null) return null;
    scale = a;
  }
  const descriptor = font.lookup(PDFName.of("FontDescriptor"));
  const missing =
    (descriptor instanceof PDFDict
      ? num(descriptor.lookup(PDFName.of("MissingWidth")))
      : null) ?? 0;
  return {
    kind: subtype === "/Type3" ? "type3" : "simple",
    firstChar,
    widths,
    missing,
    cidW: null,
    dw: missing,
    scale,
  };
}

/** Text-space advance of a show op's operands. null = uncomputable. */
function advanceOf(
  operands: Operand[],
  table: WidthTable | null,
  Tfs: number,
  Tc: number,
  Tw: number,
  Th: number,
): number | null {
  if (!table) return null;
  let tx = 0;
  const glyphs = (bytes: Uint8Array) => {
    if (table.kind === "cid2") {
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const cid = (bytes[i] << 8) | bytes[i + 1];
        const w = table.cidW?.get(cid) ?? table.dw;
        tx += w * table.scale * Tfs + Tc;
      }
    } else {
      for (const b of bytes) {
        const idx = b - table.firstChar;
        const w =
          idx >= 0 && idx < table.widths.length ? table.widths[idx] : table.missing;
        tx += w * table.scale * Tfs + Tc + (b === 0x20 ? Tw : 0);
      }
    }
  };
  for (const op of operands) {
    if (op.type === "string") glyphs(op.bytes);
    else if (op.type === "array") {
      for (const item of op.items) {
        if (item.type === "string") glyphs(item.bytes);
        else if (item.type === "number") tx += (-item.value / 1000) * Tfs;
      }
    }
  }
  return tx * Th;
}

// ——— content access ———

const SHOW_OPS = new Set(["Tj", "TJ", "'", '"']);
const REPOSITION_OPS = new Set(["Tm", "Td", "TD", "T*", "ET", "BT"]);

/** Decode a page's content stream(s) into one joined buffer. */
export function readPageContent(page: PDFPage): Uint8Array | null {
  const contents = page.node.Contents();
  const streams: Uint8Array[] = [];
  const pushStream = (obj: unknown) => {
    if (obj instanceof PDFRawStream) streams.push(decodePDFRawStream(obj).decode());
  };
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) pushStream(contents.lookup(i));
    if (streams.length !== contents.size()) return null;
  } else {
    pushStream(contents);
    if (streams.length !== 1) return null;
  }
  // Streams are semantically concatenated with whitespace between them.
  const total = streams.reduce((n, s) => n + s.length + 1, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const s of streams) {
    joined.set(s, offset);
    offset += s.length;
    joined[offset++] = 0x0a;
  }
  return joined;
}

function writePageContent(page: PDFPage, bytes: Uint8Array): void {
  const ctx = page.node.context;
  const ref = ctx.register(ctx.flateStream(bytes));
  page.node.set(PDFName.of("Contents"), ref);
}

function fontDictFor(page: PDFPage, resourceName: string): PDFDict | null {
  const resources = page.node.Resources();
  if (!(resources instanceof PDFDict)) return null;
  const fonts = resources.lookup(PDFName.of("Font"));
  if (!(fonts instanceof PDFDict)) return null;
  const font = fonts.lookup(PDFName.of(resourceName));
  return font instanceof PDFDict ? font : null;
}

// ——— the interpreter ———

interface ShowOp {
  record: OpRecord;
  index: number;
  pos: { x: number; y: number };
  /** False when a preceding uncomputable advance made the pen position stale. */
  posReliable: boolean;
  effSize: number;
  advance: number | null;
  Tr: number;
  /** Font size / horizontal scale in effect at this op (for the compensator). */
  Tfs: number;
  Th: number;
  /** For ' and ": the line-advance side effects that must be preserved. */
  quote: null | { tw?: number; tc?: number };
}

function asNumbers(operands: Operand[]): number[] {
  return operands.map((o) => (o.type === "number" ? o.value : 0));
}

/**
 * Remove all text intersecting the given regions from a page.
 * Regions use top-left-origin PDF points.
 */
export function removeTextInRegions(
  _doc: PDFDocument,
  page: PDFPage,
  regions: EditRegion[],
): RemovalResult {
  const removed = regions.map(() => 0);
  const invisible = regions.map(() => 0);
  if (regions.length === 0) return { removed, invisible };

  const src = readPageContent(page);
  if (!src) return { removed, invisible };
  const records = tokenizeContentStream(src);
  const pageH = page.getHeight();

  // Pass 1 — interpret, collecting show ops with device positions.
  const shows: ShowOp[] = [];
  const widthCache = new Map<string, WidthTable | null>();
  const ctmStack: Mat[] = [];
  let ctm: Mat = IDENTITY;
  let Tm: Mat = IDENTITY;
  let Tlm: Mat = IDENTITY;
  let TL = 0;
  let Tc = 0;
  let Tw = 0;
  let Th = 1;
  let Ts = 0;
  let Tr = 0;
  let Tfs = 0;
  let TfName = "";

  const widthTable = (): WidthTable | null => {
    if (!TfName) return null;
    if (!widthCache.has(TfName)) {
      const dict = fontDictFor(page, TfName);
      widthCache.set(TfName, dict ? resolveWidthTable(dict) : null);
    }
    return widthCache.get(TfName) ?? null;
  };

  // After a show op with an uncomputable advance, the horizontal pen position
  // is unknown until the next absolute repositioning — matching would be
  // guesswork, and we never remove text we can't reliably locate.
  let posReliable = true;

  const newline = () => {
    Tlm = concat(translate(0, -TL), Tlm);
    Tm = Tlm;
    posReliable = true;
  };

  const show = (record: OpRecord, index: number, quote: ShowOp["quote"]) => {
    const m = concat(Tm, ctm);
    const pos = apply(m, 0, Ts);
    const effSize = Tfs * Math.hypot(m[2], m[3]);
    const advance = advanceOf(record.operands, widthTable(), Tfs, Tc, Tw, Th);
    shows.push({ record, index, pos, posReliable, effSize, advance, Tr, Tfs, Th, quote });
    if (advance !== null) Tm = concat(translate(advance, 0), Tm);
    else posReliable = false;
  };

  records.forEach((record, index) => {
    const n = asNumbers(record.operands);
    switch (record.operator) {
      case "q":
        ctmStack.push(ctm);
        break;
      case "Q":
        ctm = ctmStack.pop() ?? IDENTITY;
        break;
      case "cm":
        ctm = concat([n[0], n[1], n[2], n[3], n[4], n[5]], ctm);
        break;
      case "BT":
        Tm = IDENTITY;
        Tlm = IDENTITY;
        posReliable = true;
        break;
      case "Tm":
        Tm = [n[0], n[1], n[2], n[3], n[4], n[5]];
        Tlm = Tm;
        posReliable = true;
        break;
      case "Td":
        Tlm = concat(translate(n[0], n[1]), Tlm);
        Tm = Tlm;
        posReliable = true;
        break;
      case "TD":
        TL = -n[1];
        Tlm = concat(translate(n[0], n[1]), Tlm);
        Tm = Tlm;
        posReliable = true;
        break;
      case "T*":
        newline();
        break;
      case "TL":
        TL = n[0];
        break;
      case "Tf": {
        const name = record.operands[0];
        TfName = name?.type === "name" ? name.value : "";
        Tfs = n[1] ?? 0;
        break;
      }
      case "Tz":
        Th = (n[0] ?? 100) / 100;
        break;
      case "Tc":
        Tc = n[0] ?? 0;
        break;
      case "Tw":
        Tw = n[0] ?? 0;
        break;
      case "Ts":
        Ts = n[0] ?? 0;
        break;
      case "Tr":
        Tr = n[0] ?? 0;
        break;
      case "Tj":
      case "TJ":
        show(record, index, null);
        break;
      case "'":
        newline();
        show(record, index, {});
        break;
      case '"':
        Tw = n[0] ?? Tw;
        Tc = n[1] ?? Tc;
        newline();
        show(record, index, { tw: n[0], tc: n[1] });
        break;
    }
  });

  // Pass 2 — match shows to regions and build edits.
  const deviceRegions = regions.map((r) => ({
    x0: r.x - 2,
    x1: r.x + r.w + 2,
    baselineY: pageH - r.baseline,
  }));

  const enc = (s: string) => new TextEncoder().encode(s);
  const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
  const edits: StreamEdit[] = [];

  for (let s = 0; s < shows.length; s++) {
    const op = shows[s];
    if (!op.posReliable) continue;
    const regionIdx = deviceRegions.findIndex(
      (r) =>
        Math.abs(op.pos.y - r.baselineY) < Math.max(0.45 * op.effSize, 1) &&
        op.pos.x >= r.x0 &&
        op.pos.x <= r.x1,
    );
    if (regionIdx < 0) continue;

    // Does any later show op in this text block depend on this op's advance?
    let dependent = false;
    for (let i = op.index + 1; i < records.length; i++) {
      const operator = records[i].operator;
      if (REPOSITION_OPS.has(operator)) break;
      if (SHOW_OPS.has(operator)) {
        // ' and " reposition themselves via their internal T*.
        dependent = operator === "Tj" || operator === "TJ";
        break;
      }
    }

    const { start, end } = op.record;
    // Side effects of ' and " (line advance, Tw/Tc) must be preserved.
    const prefix =
      op.quote === null
        ? ""
        : `${op.quote.tw !== undefined ? `${fmt(op.quote.tw)} Tw ` : ""}${
            op.quote.tc !== undefined ? `${fmt(op.quote.tc)} Tc ` : ""
          }T* `;

    if (!dependent) {
      if (prefix) edits.push({ type: "replace", start, end, bytes: enc(prefix.trim()) });
      else edits.push({ type: "delete", start, end });
      removed[regionIdx]++;
    } else if (op.advance !== null && op.Tfs !== 0) {
      // Keep the pen where it would have been: a lone TJ number adjusts Tm
      // by (-n/1000)·Tfs·Th without drawing anything.
      const n = (-op.advance * 1000) / (op.Tfs * (op.Th || 1));
      edits.push({
        type: "replace",
        start,
        end,
        bytes: enc(`${prefix}[ ${fmt(n)} ] TJ`),
      });
      removed[regionIdx]++;
    } else {
      // Widths uncomputable — keep the op but render it invisibly.
      const original = src.subarray(start, end);
      const head = enc("3 Tr ");
      const tail = enc(` ${op.Tr} Tr`);
      const wrapped = new Uint8Array(head.length + original.length + tail.length);
      wrapped.set(head, 0);
      wrapped.set(original, head.length);
      wrapped.set(tail, head.length + original.length);
      edits.push({ type: "replace", start, end, bytes: wrapped });
      invisible[regionIdx]++;
    }
  }

  if (edits.length > 0) {
    writePageContent(page, spliceStream(src, edits));
  }
  return { removed, invisible };
}
