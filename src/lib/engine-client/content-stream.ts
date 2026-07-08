/**
 * PDF content-stream tokenizer and byte splicer.
 *
 * Tokenizes a DECODED content stream into operator records that carry exact
 * byte offsets into the source, so specific operators can be removed or
 * replaced by splicing bytes — leaving every other byte untouched. pdf-lib
 * can compose new streams but has no tokenizer for existing ones; this fills
 * that gap for the inline text-edit feature.
 *
 * Pure module: no DOM, no worker APIs — fully unit-testable in Node.
 */

export type Operand =
  | { type: "number"; value: number }
  | { type: "string"; bytes: Uint8Array }
  | { type: "name"; value: string }
  | { type: "array"; items: Operand[] }
  | { type: "dict" }
  | { type: "bool"; value: boolean }
  | { type: "null" };

export interface OpRecord {
  operator: string;
  operands: Operand[];
  /** Byte offset of the first operand (or of the operator when none). */
  start: number;
  /** Byte offset just past the operator keyword. */
  end: number;
}

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

function isRegular(b: number): boolean {
  return !WS.has(b) && !DELIM.has(b);
}

class Lexer {
  pos = 0;
  constructor(readonly src: Uint8Array) {}

  get eof(): boolean {
    return this.pos >= this.src.length;
  }

  peek(): number {
    return this.src[this.pos];
  }

  skipWsAndComments(): void {
    while (!this.eof) {
      const b = this.peek();
      if (WS.has(b)) {
        this.pos++;
      } else if (b === 0x25 /* % */) {
        while (!this.eof && this.peek() !== 0x0a && this.peek() !== 0x0d) this.pos++;
      } else {
        return;
      }
    }
  }

  /** Literal string after "(" — returns decoded bytes; pos ends after ")". */
  literalString(): Uint8Array {
    const out: number[] = [];
    let depth = 1;
    this.pos++; // consume "("
    while (!this.eof) {
      const b = this.src[this.pos++];
      if (b === 0x5c /* \ */) {
        if (this.eof) break;
        const e = this.src[this.pos++];
        switch (e) {
          case 0x6e: out.push(0x0a); break; // \n
          case 0x72: out.push(0x0d); break; // \r
          case 0x74: out.push(0x09); break; // \t
          case 0x62: out.push(0x08); break; // \b
          case 0x66: out.push(0x0c); break; // \f
          case 0x28: out.push(0x28); break; // \(
          case 0x29: out.push(0x29); break; // \)
          case 0x5c: out.push(0x5c); break; // \\
          case 0x0d: // line continuation: \CR or \CRLF
            if (!this.eof && this.peek() === 0x0a) this.pos++;
            break;
          case 0x0a: // \LF continuation
            break;
          default:
            if (e >= 0x30 && e <= 0x37) {
              // 1-3 octal digits
              let v = e - 0x30;
              for (let i = 0; i < 2 && !this.eof; i++) {
                const d = this.peek();
                if (d < 0x30 || d > 0x37) break;
                v = v * 8 + (d - 0x30);
                this.pos++;
              }
              out.push(v & 0xff);
            } else {
              out.push(e); // unknown escape: PDF spec says drop the backslash
            }
        }
      } else if (b === 0x28) {
        depth++;
        out.push(b);
      } else if (b === 0x29) {
        depth--;
        if (depth === 0) break;
        out.push(b);
      } else {
        out.push(b);
      }
    }
    return Uint8Array.from(out);
  }

  /** Hex string after "<" (not "<<") — pos ends after ">". */
  hexString(): Uint8Array {
    this.pos++; // consume "<"
    const digits: number[] = [];
    while (!this.eof) {
      const b = this.src[this.pos++];
      if (b === 0x3e /* > */) break;
      const v =
        b >= 0x30 && b <= 0x39
          ? b - 0x30
          : b >= 0x41 && b <= 0x46
            ? b - 0x41 + 10
            : b >= 0x61 && b <= 0x66
              ? b - 0x61 + 10
              : -1;
      if (v >= 0) digits.push(v);
    }
    if (digits.length % 2 === 1) digits.push(0);
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = digits[i * 2] * 16 + digits[i * 2 + 1];
    return out;
  }

  name(): string {
    this.pos++; // consume "/"
    let out = "";
    while (!this.eof && isRegular(this.peek())) {
      let b = this.src[this.pos++];
      if (b === 0x23 /* # */ && this.pos + 1 < this.src.length) {
        const hex = String.fromCharCode(this.src[this.pos], this.src[this.pos + 1]);
        const v = parseInt(hex, 16);
        if (!Number.isNaN(v)) {
          b = v;
          this.pos += 2;
        }
      }
      out += String.fromCharCode(b);
    }
    return out;
  }

  /** Bare token of regular characters (number or operator keyword). */
  bareToken(): string {
    let out = "";
    while (!this.eof && isRegular(this.peek())) {
      out += String.fromCharCode(this.src[this.pos++]);
    }
    return out;
  }

  /** Skip a dictionary "<<...>>" including nested content; pos after ">>". */
  skipDict(): void {
    this.pos += 2; // "<<"
    while (!this.eof) {
      this.skipWsAndComments();
      if (this.eof) return;
      const b = this.peek();
      if (b === 0x3e /* > */ && this.src[this.pos + 1] === 0x3e) {
        this.pos += 2;
        return;
      }
      this.skipValue();
    }
  }

  /** Skip any single object value (used inside dicts). */
  skipValue(): void {
    const b = this.peek();
    if (b === 0x2f /* / */) this.name();
    else if (b === 0x28 /* ( */) this.literalString();
    else if (b === 0x3c /* < */) {
      if (this.src[this.pos + 1] === 0x3c) this.skipDict();
      else this.hexString();
    } else if (b === 0x5b /* [ */) {
      this.pos++;
      while (!this.eof) {
        this.skipWsAndComments();
        if (this.peek() === 0x5d /* ] */) {
          this.pos++;
          return;
        }
        this.skipValue();
      }
    } else {
      const t = this.bareToken();
      if (!t) this.pos++; // stray delimiter — never loop forever
    }
  }
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** After "BI", skip past the inline image's dict, binary data, and "EI". */
function skipInlineImage(lx: Lexer): void {
  // Skip key/value pairs until the ID operator.
  for (;;) {
    lx.skipWsAndComments();
    if (lx.eof) return;
    const before = lx.pos;
    if (lx.peek() === 0x2f /* / */) {
      lx.name();
      lx.skipWsAndComments();
      lx.skipValue();
      continue;
    }
    const t = lx.bareToken();
    if (t === "ID") break;
    if (!t) {
      lx.pos = before + 1;
    }
  }
  // One whitespace byte after ID, then binary data until whitespace+"EI"+delimiter.
  if (!lx.eof && WS.has(lx.peek())) lx.pos++;
  const src = lx.src;
  for (let i = lx.pos; i < src.length - 1; i++) {
    if (
      src[i] === 0x45 /* E */ &&
      src[i + 1] === 0x49 /* I */ &&
      (i === 0 || WS.has(src[i - 1])) &&
      (i + 2 >= src.length || WS.has(src[i + 2]) || DELIM.has(src[i + 2]))
    ) {
      lx.pos = i + 2;
      return;
    }
  }
  lx.pos = src.length;
}

/** Parse one operand starting at the current position (caller skipped ws). */
function parseOperand(lx: Lexer): Operand | { operator: string } {
  const b = lx.peek();
  if (b === 0x2f /* / */) return { type: "name", value: lx.name() };
  if (b === 0x28 /* ( */) return { type: "string", bytes: lx.literalString() };
  if (b === 0x3c /* < */) {
    if (lx.src[lx.pos + 1] === 0x3c) {
      lx.skipDict();
      return { type: "dict" };
    }
    return { type: "string", bytes: lx.hexString() };
  }
  if (b === 0x5b /* [ */) {
    lx.pos++;
    const items: Operand[] = [];
    for (;;) {
      lx.skipWsAndComments();
      if (lx.eof || lx.peek() === 0x5d /* ] */) {
        lx.pos++;
        return { type: "array", items };
      }
      const v = parseOperand(lx);
      if ("operator" in v) {
        // malformed array content — treat the keyword as noise and continue
        continue;
      }
      items.push(v);
    }
  }
  if (b === 0x7b || b === 0x7d) {
    // {} PostScript procs (Type4 functions) never appear in page streams; skip.
    lx.pos++;
    return { type: "null" };
  }
  const t = lx.bareToken();
  if (!t) {
    lx.pos++; // stray delimiter such as an unbalanced ")"
    return { type: "null" };
  }
  if (NUMBER_RE.test(t)) return { type: "number", value: parseFloat(t) };
  if (t === "true") return { type: "bool", value: true };
  if (t === "false") return { type: "bool", value: false };
  if (t === "null") return { type: "null" };
  return { operator: t };
}

export function tokenizeContentStream(src: Uint8Array): OpRecord[] {
  const lx = new Lexer(src);
  const records: OpRecord[] = [];
  let operands: Operand[] = [];
  let groupStart = -1;

  for (;;) {
    lx.skipWsAndComments();
    if (lx.eof) break;
    const tokenStart = lx.pos;
    const parsed = parseOperand(lx);
    if ("operator" in parsed) {
      if (parsed.operator === "BI") {
        skipInlineImage(lx);
        records.push({
          operator: "BI",
          operands: [],
          start: groupStart >= 0 ? groupStart : tokenStart,
          end: lx.pos,
        });
      } else {
        records.push({
          operator: parsed.operator,
          operands,
          start: groupStart >= 0 ? groupStart : tokenStart,
          end: lx.pos,
        });
      }
      operands = [];
      groupStart = -1;
    } else {
      if (groupStart < 0) groupStart = tokenStart;
      operands.push(parsed);
    }
  }
  return records;
}

export type StreamEdit =
  | { type: "delete"; start: number; end: number }
  | { type: "insert"; at: number; bytes: Uint8Array }
  | { type: "replace"; start: number; end: number; bytes: Uint8Array };

function editPos(e: StreamEdit): number {
  return e.type === "insert" ? e.at : e.start;
}

/**
 * Apply byte-range edits to a stream. Edits must not overlap; an empty edit
 * list returns a byte-identical copy (the tokenizer round-trip invariant).
 */
export function spliceStream(src: Uint8Array, edits: StreamEdit[]): Uint8Array {
  const sorted = [...edits].sort((a, b) => editPos(a) - editPos(b));
  const parts: Uint8Array[] = [];
  let cursor = 0;
  for (const edit of sorted) {
    const at = editPos(edit);
    if (at < cursor) throw new Error("Overlapping stream edits");
    parts.push(src.subarray(cursor, at));
    if (edit.type === "delete") {
      cursor = edit.end;
      // Deleting an operator can fuse neighboring tokens — keep a separator.
      parts.push(Uint8Array.from([0x20]));
    } else if (edit.type === "replace") {
      parts.push(edit.bytes);
      cursor = edit.end;
    } else {
      parts.push(edit.bytes);
      cursor = at;
    }
  }
  parts.push(src.subarray(cursor));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
