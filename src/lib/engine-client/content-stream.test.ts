import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  spliceStream,
  tokenizeContentStream,
  type OpRecord,
} from "./content-stream";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

function ops(src: string): OpRecord[] {
  return tokenizeContentStream(enc(src));
}

describe("tokenizeContentStream", () => {
  it("tokenizes a basic text block with offsets", () => {
    const src = "BT /F1 12 Tf 72 700 Td (Hello) Tj ET";
    const records = ops(src);
    expect(records.map((r) => r.operator)).toEqual(["BT", "Tf", "Td", "Tj", "ET"]);
    const tf = records[1];
    expect(tf.operands).toEqual([
      { type: "name", value: "F1" },
      { type: "number", value: 12 },
    ]);
    // offsets cover "/F1 12 Tf"
    expect(src.slice(tf.start, tf.end)).toBe("/F1 12 Tf");
    const tj = records[3];
    expect(dec((tj.operands[0] as { bytes: Uint8Array }).bytes)).toBe("Hello");
    expect(src.slice(tj.start, tj.end)).toBe("(Hello) Tj");
  });

  it("parses TJ arrays with mixed strings and kerning numbers", () => {
    const records = ops("[ (A) -120 (B) 3.5 (C) ] TJ");
    expect(records).toHaveLength(1);
    const arr = records[0].operands[0];
    expect(arr.type).toBe("array");
    const items = (arr as { items: { type: string }[] }).items;
    expect(items.map((i) => i.type)).toEqual([
      "string",
      "number",
      "string",
      "number",
      "string",
    ]);
  });

  it("decodes literal string escapes, nested parens, and octal", () => {
    const records = ops(String.raw`(a\)b (nested) \101\n) Tj`);
    const bytes = (records[0].operands[0] as { bytes: Uint8Array }).bytes;
    expect(dec(bytes)).toBe("a)b (nested) A\n");
  });

  it("decodes hex strings including odd-length padding", () => {
    const records = ops("<48656C6C6F> Tj <4> Tj");
    expect(dec((records[0].operands[0] as { bytes: Uint8Array }).bytes)).toBe("Hello");
    expect((records[1].operands[0] as { bytes: Uint8Array }).bytes).toEqual(
      Uint8Array.from([0x40]),
    );
  });

  it("handles number forms .5 -.5 4. +3", () => {
    const records = ops(".5 -.5 4. +3 re");
    expect(records[0].operands.map((o) => (o as { value: number }).value)).toEqual([
      0.5, -0.5, 4, 3,
    ]);
  });

  it("skips comments and dict operands (BDC)", () => {
    const records = ops(
      "%comment ( with parens\n/Span <</ActualText (hi \\(x\\))>> BDC (T) Tj EMC",
    );
    expect(records.map((r) => r.operator)).toEqual(["BDC", "Tj", "EMC"]);
    expect(records[0].operands.map((o) => o.type)).toEqual(["name", "dict"]);
  });

  it("skips inline images without parsing binary data", () => {
    // binary payload contains a fake "EI" not preceded by whitespace-delimiter
    const src = "q BI /W 2 /H 2 /BPC 8 /CS /G ID \x00EIx\x01\xff EI Q (after) Tj";
    const records = tokenizeContentStream(
      Uint8Array.from(src, (c) => c.charCodeAt(0)),
    );
    expect(records.map((r) => r.operator)).toEqual(["q", "BI", "Q", "Tj"]);
  });

  it("produces monotonically increasing, non-overlapping offsets", () => {
    const src = "BT /F1 12 Tf 1 0 0 1 72 700 Tm [ (A) -3 (B) ] TJ T* (x) ' ET";
    const records = ops(src);
    for (let i = 1; i < records.length; i++) {
      expect(records[i].start).toBeGreaterThanOrEqual(records[i - 1].end);
    }
  });

  it("tokenizes a real pdf-lib page stream", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 800]);
    page.drawText("Alpha", { x: 72, y: 700, size: 24, font });
    const doc2 = await PDFDocument.load(await doc.save());
    const contents = doc2.getPage(0).node.Contents();
    expect(contents).toBeInstanceOf(PDFArray);
    const stream = doc2
      .getPage(0)
      .node.context.lookup((contents as PDFArray).get(0));
    const bytes = decodePDFRawStream(stream as PDFRawStream).decode();
    const records = tokenizeContentStream(bytes);
    const operators = records.map((r) => r.operator);
    expect(operators).toContain("BT");
    expect(operators).toContain("Tf");
    expect(operators).toContain("Tj");
    expect(operators).toContain("ET");
  });
});

describe("spliceStream", () => {
  it("returns identical bytes for an empty edit list", () => {
    const src = enc("BT (Hello) Tj ET");
    expect(dec(spliceStream(src, []))).toBe("BT (Hello) Tj ET");
  });

  it("deletes an operator record cleanly", () => {
    const src = "BT (A) Tj (B) Tj ET";
    const records = ops(src);
    const firstTj = records[1];
    const out = dec(spliceStream(enc(src), [
      { type: "delete", start: firstTj.start, end: firstTj.end },
    ]));
    const remaining = tokenizeContentStream(enc(out));
    expect(remaining.map((r) => r.operator)).toEqual(["BT", "Tj", "ET"]);
    expect(out).not.toContain("(A)");
    expect(out).toContain("(B)");
  });

  it("inserts bytes at a position", () => {
    const src = enc("BT ET");
    const out = dec(
      spliceStream(src, [{ type: "insert", at: 3, bytes: enc("(X) Tj ") }]),
    );
    expect(out).toBe("BT (X) Tj ET");
  });

  it("rejects overlapping edits", () => {
    const src = enc("0123456789");
    expect(() =>
      spliceStream(src, [
        { type: "delete", start: 2, end: 6 },
        { type: "delete", start: 4, end: 8 },
      ]),
    ).toThrow(/Overlapping/);
  });
});
